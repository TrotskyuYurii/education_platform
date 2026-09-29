import nodemailer from 'nodemailer';
import { SystemLogService } from './modules/system/service.js';

/* ------------------------------------------------------------------ *
 * Транспорти пошти
 *
 * Два канали, у кожного свій транспорт:
 *   • коди входу (OTP)  — OTP_POWER_AUTOMATE_URL, інакше SMTP;
 *   • сповіщення        — NOTIFICATION_POWER_AUTOMATE_URL, інакше SMTP.
 *
 * Power Automate — основний шлях у продакшені: у тенанті Microsoft 365 SMTP AUTH
 * вимкнено. Контракти flow ті самі, що й у IDL (idl.viasecurity.tech):
 *   OTP:          POST { email, passcode, service } — лист формує сам flow;
 *   сповіщення:   POST { email, subject, body } на кожного отримувача, body — HTML.
 *                 Flow приймає рівно ці три ключі, зайвий ключ він відхиляє.
 * URL flow містить підпис доступу (sig=...) — це секрет: у логи, журнал і
 * тексти помилок він не потрапляє.
 *
 * Запобіжники навколо відправки — невдалий лист не має ані блокувати
 * HTTP-запит, ані з'їдати ресурси процесу:
 *   1) circuit breaker на кожен транспорт — після кількох поспіль невдач
 *      подальші спроби відсікаються миттєво (0 мс), поки не мине cooldown;
 *   2) обмежувач паралельності — масова розсилка не відкриє сотні з'єднань;
 *   3) pool для SMTP — з'єднання перевикористовуються замість handshake на лист.
 * ------------------------------------------------------------------ */

const FAILURE_THRESHOLD = 3;          // скільки невдач поспіль відкривають circuit
const BASE_COOLDOWN_MS = 60_000;      // перший період «тиші»
const MAX_COOLDOWN_MS = 15 * 60_000;  // стеля експоненційного відкату
const MAX_CONCURRENT_SENDS = 2;       // одночасних відправок сповіщень (== maxConnections пулу)
const MAX_QUEUE_LENGTH = 200;         // понад це — лист відкидається, а не накопичується
const HTTP_TIMEOUT_MS = 15_000;       // Power Automate відповідає за 1–3 с; довше — вважаємо збоєм

const DEFAULT_FROM = '"ВІАТЕК Безпека" <no-reply@viatec.ua>';
const DEFAULT_OTP_SERVICE = 'ep.viasecurity.tech';
const CONFIG_HINT = 'Задайте OTP_POWER_AUTOMATE_URL / NOTIFICATION_POWER_AUTOMATE_URL (Power Automate) або SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS';

class CircuitBreaker {
  private consecutiveFailures = 0;
  private openUntil = 0;
  private cooldownMs = BASE_COOLDOWN_MS;
  lastFailureMessage = '';

  constructor(private readonly label: string, private readonly logDetails: () => Record<string, unknown>) {}

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  error(): string {
    return `${this.label} недоступний, спроби призупинено ще на ${Math.ceil((this.openUntil - Date.now()) / 1000)} с`;
  }

  recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      console.log(`✉️ ${this.label} відновився, лічильник невдач скинуто`);
    }
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.cooldownMs = BASE_COOLDOWN_MS;
  }

  recordFailure(errorMessage?: string): void {
    if (errorMessage) this.lastFailureMessage = errorMessage;
    // Це пробна спроба після cooldown, а не чергова помилка з одного залпу?
    const failedProbe = this.openUntil > 0 && Date.now() >= this.openUntil;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures < FAILURE_THRESHOLD) return;

    // Відкат росте лише тоді, коли впав саме пробний лист після паузи.
    // Інакше одна масова розсилка за мілісекунди розігнала б паузу до стелі.
    if (failedProbe) {
      this.cooldownMs = Math.min(this.cooldownMs * 2, MAX_COOLDOWN_MS);
    }
    if (Date.now() >= this.openUntil) {
      this.openUntil = Date.now() + this.cooldownMs;
      console.warn(
        `⚠️ ${this.label}: ${this.consecutiveFailures} невдач поспіль — відправку призупинено на ${this.cooldownMs / 1000} с`
      );
      // Окремий запис у журналі: це вже не «один лист не дійшов», а пошта лежить —
      // саме це адміністратор має побачити першим.
      SystemLogService.capture({
        level: 'error',
        source: 'email',
        event: 'SMTP_CIRCUIT_OPEN',
        message: `${this.label} не відповідає: ${this.consecutiveFailures} невдач поспіль, відправку призупинено на ${Math.round(this.cooldownMs / 1000)} с`,
        details: {
          ...this.logDetails(),
          consecutiveFailures: this.consecutiveFailures,
          cooldownSeconds: Math.round(this.cooldownMs / 1000),
          lastError: this.lastFailureMessage
        },
        dedupeKey: `circuit-open:${this.label}`
      });
    }
  }
}

interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface MailTransport {
  /** Для логів і журналу: без секретів. */
  label: string;
  breaker: CircuitBreaker;
  details(): Record<string, unknown>;
  send(mail: OutgoingMail): Promise<void>;
}

/* --- SMTP ---------------------------------------------------------- */

let smtpTransporter: any = null;
let smtpTransport: MailTransport | null = null;

export function getEmailTransporter(): any {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST;
  if (host) {
    try {
      smtpTransporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || '',
        } : undefined,
        // Nodemailer's defaults wait up to 2 min to connect and 10 min on a silent
        // socket. A mail server that stops answering must not hold an HTTP request
        // (or the nightly digest) hostage for minutes — fail fast and log instead.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        // Пул тримає з'єднання відкритим: розсилка на N користувачів більше
        // не платить SMTP-handshake за кожен лист.
        pool: true,
        maxConnections: MAX_CONCURRENT_SENDS,
        maxMessages: 50,
      });
      // Пул емітить 'error' на рівні транспорту (обрив idle-сокета тощо).
      // Без слухача Node звалив би весь процес на unhandled 'error'.
      smtpTransporter.on?.('error', (err: any) => {
        console.error('⚠️ SMTP pool error:', err?.message || err);
      });
      console.log(`✉️ SMTP Transporter initialized for host: ${host}`);
    } catch (err) {
      console.error('⚠️ Failed to initialize SMTP Transporter:', err);
      smtpTransporter = null;
    }
  }
  return smtpTransporter;
}

function getSmtpTransport(): MailTransport | null {
  if (smtpTransport) return smtpTransport;
  const t = getEmailTransporter();
  if (!t) return null;
  const details = () => ({ transport: 'smtp', host: process.env.SMTP_HOST, port: process.env.SMTP_PORT || '587' });
  smtpTransport = {
    label: 'Поштовий сервер (SMTP)',
    breaker: new CircuitBreaker('SMTP', details),
    details,
    async send(mail) {
      await t.sendMail({
        from: process.env.SMTP_FROM || DEFAULT_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    }
  };
  return smtpTransport;
}

/* --- Power Automate ------------------------------------------------ */

/**
 * POST JSON у flow. Кидає помилку з кодом статусу та початком відповіді —
 * але без URL: у ньому підпис доступу.
 */
async function postToFlow(url: string, payload: Record<string, string>): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch (err: any) {
    const reason = err?.name === 'TimeoutError'
      ? `немає відповіді за ${HTTP_TIMEOUT_MS / 1000} с`
      : (err?.cause?.code || err?.cause?.message || err?.message || 'network error');
    throw new Error(`Power Automate: ${reason}`);
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300).trim();
    throw new Error(`Power Automate: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
  }
}

// Breaker живе довше за один виклик: транспорт Power Automate створюється щоразу
// (URL читається з оточення), а стан збоїв має накопичуватись між листами.
const powerAutomateBreakers = new Map<string, CircuitBreaker>();

function powerAutomateTransport(kind: 'otp' | 'notification', url: string): MailTransport {
  const details = () => ({ transport: 'power-automate', flow: kind });
  let breaker = powerAutomateBreakers.get(kind);
  if (!breaker) {
    breaker = new CircuitBreaker(kind === 'otp' ? 'Power Automate (коди входу)' : 'Power Automate (сповіщення)', details);
    powerAutomateBreakers.set(kind, breaker);
  }
  return {
    label: 'Power Automate',
    breaker,
    details,
    async send(mail) {
      // Flow сповіщень приймає рівно { email, subject, body } і рендерить body як HTML.
      await postToFlow(url, { email: mail.to.trim(), subject: mail.subject.trim(), body: mail.html });
    }
  };
}

/** Транспорт сповіщень: Power Automate, якщо задано URL flow, інакше SMTP. */
function getNotificationTransport(): MailTransport | null {
  const url = process.env.NOTIFICATION_POWER_AUTOMATE_URL?.trim();
  if (url) return powerAutomateTransport('notification', url);
  return getSmtpTransport();
}

/**
 * Транспорт кодів входу. Flow Power Automate сам формує лист із кодом, тож
 * йому йде лише код — а SMTP отримує готовий лист.
 */
function getAuthCodeTransport(): (MailTransport & { sendCode?: (to: string, code: string) => Promise<void> }) | null {
  const url = process.env.OTP_POWER_AUTOMATE_URL?.trim();
  if (url) {
    const transport = powerAutomateTransport('otp', url);
    const service = process.env.OTP_POWER_AUTOMATE_SERVICE?.trim() || DEFAULT_OTP_SERVICE;
    return {
      ...transport,
      sendCode: (to, code) => postToFlow(url, { email: to.trim(), passcode: code.trim(), service }),
    };
  }
  return getSmtpTransport();
}

/**
 * Чи відсічена зараз відправка сповіщень. Фонові розсилки (дайджест) використовують
 * це, щоб не проганяти сотні листів по мертвому транспорту, а відкласти їх на наступний прогін.
 */
export const isEmailCircuitOpen = (): boolean => getNotificationTransport()?.breaker.isOpen() ?? false;

// --- обмежувач паралельності ---------------------------------------
let inFlight = 0;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<boolean> {
  if (inFlight < MAX_CONCURRENT_SENDS) {
    inFlight += 1;
    return Promise.resolve(true);
  }
  if (waiters.length >= MAX_QUEUE_LENGTH) return Promise.resolve(false);
  return new Promise<boolean>(resolve => {
    waiters.push(() => {
      inFlight += 1;
      resolve(true);
    });
  });
}

function releaseSlot(): void {
  inFlight -= 1;
  waiters.shift()?.();
}

/**
 * Generates an 8-character random verification code
 */
export function generateAuthCode(): string {
  // 8 alphanumeric uppercase characters, omitting easily confusable characters (0/O, 1/I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generic email sender for notifications. Unlike sendAuthCodeEmail, this never
 * throws — a notification email failing (or mail being unconfigured) must not
 * break the in-app flow that triggered it, it should just be logged and skipped.
 *
 * Крім того, воно ніколи не «висить»: якщо circuit breaker відкритий (транспорт уже
 * впав кілька разів поспіль) або черга переповнена, функція повертається миттєво.
 */
export async function sendEmail(
  toEmail: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; error?: string }> {
  const t = getNotificationTransport();
  if (!t) {
    console.warn(`✉️ Skipped notification email to ${toEmail} (mail not configured): ${subject}`);
    SystemLogService.capture({
      level: 'warning',
      source: 'email',
      event: 'SMTP_NOT_CONFIGURED',
      message: 'Відправку пошти не налаштовано — листи сповіщень не відправляються',
      details: { lastRecipient: toEmail, subject, hint: CONFIG_HINT },
      dedupeKey: 'smtp-not-configured'
    });
    return { success: false, error: 'mail not configured' };
  }
  if (t.breaker.isOpen()) {
    console.warn(`✉️ Skipped notification email to ${toEmail}: ${t.breaker.error()}`);
    return { success: false, error: t.breaker.error() };
  }
  const gotSlot = await acquireSlot();
  if (!gotSlot) {
    console.warn(`✉️ Skipped notification email to ${toEmail}: черга відправки переповнена`);
    SystemLogService.capture({
      level: 'warning',
      source: 'email',
      event: 'EMAIL_QUEUE_OVERFLOW',
      message: `Черга відправки пошти переповнена (${MAX_QUEUE_LENGTH}), листи відкидаються`,
      details: { lastRecipient: toEmail, subject, queueLimit: MAX_QUEUE_LENGTH },
      dedupeKey: 'queue-overflow'
    });
    return { success: false, error: 'email queue overflow' };
  }
  try {
    // Поки лист чекав у черзі, транспорт міг впасти — перевіряємо ще раз, щоб не
    // витрачати ще один таймаут на завідомо мертвий сервер.
    if (t.breaker.isOpen()) {
      return { success: false, error: t.breaker.error() };
    }
    await t.send({ to: toEmail, subject, html, text: text || subject });
    t.breaker.recordSuccess();
    return { success: true };
  } catch (err: any) {
    const reason = err?.message || 'Unknown error';
    t.breaker.recordFailure(reason);
    console.error(`❌ Failed to send notification email to ${toEmail} via ${t.label}:`, reason);
    // Журнал адміністратора: дедуплікуємо за причиною, а не за адресатом — одна
    // масова розсилка по мертвому транспорту має дати один рядок із лічильником.
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'EMAIL_SEND_FAILED',
      message: `Не вдалося надіслати лист сповіщення: ${reason}`,
      details: { ...t.details(), lastRecipient: toEmail, subject, reason, code: err?.code, command: err?.command },
      dedupeKey: `send-failed:${err?.code || reason}`
    });
    return { success: false, error: reason };
  } finally {
    releaseSlot();
  }
}

/**
 * Fire-and-forget обгортка над sendEmail для викликів усередині обробників
 * запитів: повертає керування синхронно, тож жоден HTTP-запит не чекає на пошту.
 * sendEmail не кидає винятків, тому «плаваючий» проміс не дасть unhandled rejection.
 */
export function queueEmail(
  toEmail: string,
  subject: string,
  html: string,
  text?: string
): void {
  void sendEmail(toEmail, subject, html, text).then(result => {
    if (!result.success) {
      console.error(`✉️ Email to ${toEmail} ("${subject}") was not delivered: ${result.error}`);
    }
  });
}

/**
 * Sends one-time authorization code to user's @viatec.ua email
 */
export async function sendAuthCodeEmail(
  toEmail: string,
  code: string,
  expiresInMinutes: number = 5
): Promise<{ success: boolean; simulated: boolean }> {
  const subject = `Код авторизації ВІАТЕК: ${code}`;
  const text = `Ваш одноразовий код авторизації для входу на портал ВІАТЕК: ${code}\n\nКод дійсний протягом ${expiresInMinutes} хвилин.\nЯкщо ви не здійснювали вхід, проігноруйте цей лист.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 800;">ТОВ «ВІАТЕК»</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Портал корпоративного навчання та регламентів</p>
      </div>
      <div style="background-color: #ffffff; padding: 28px; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <p style="font-size: 15px; color: #334155; margin-top: 0; margin-bottom: 20px;">
          Ваш одноразовий код підтвердження для входу:
        </p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 14px 24px; border-radius: 10px; display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
          ${code}
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 20px; margin-bottom: 0;">
          ⏱️ Термін дії коду: <strong>${expiresInMinutes} хвилин</strong>
        </p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; margin-bottom: 0; line-height: 1.5;">
        Це автоматичне повідомлення безпеки. Якщо ви не робили спроби входу, негайно повідомте системного адміністратора.
      </p>
    </div>
  `;

  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL NOTIFICATION] To: ${toEmail}`);
  console.log(`🔑 Verification Code: [ ${code} ]`);
  console.log(`⏱️ Valid for: ${expiresInMinutes} minutes`);
  console.log(`======================================================\n`);

  const t = getAuthCodeTransport();
  if (!t) {
    // Security Policy: Never allow simulated code access if mail is missing or fails
    console.error(`❌ Failed to send auth code to ${toEmail} because mail is not configured.`);
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'AUTH_CODE_EMAIL_FAILED',
      message: 'Код авторизації не відправлено: відправку пошти не налаштовано — вхід для користувачів заблоковано',
      details: { recipient: toEmail, hint: CONFIG_HINT },
      dedupeKey: 'auth-code:not-configured'
    });
    throw new Error('Відправку пошти не налаштовано. Відправка коду та авторизація тимчасово недоступні. Зверніться до адміністратора.');
  }

  // Лист із кодом — єдиний, на який користувач реально чекає, тож він іде повз
  // чергу сповіщень (нічний дайджест не має затримувати вхід). Але circuit
  // breaker діє і тут: якщо транспорт щойно впав тричі поспіль, краще одразу
  // віддати зрозумілу помилку, ніж тримати форму входу ще 20 секунд на таймауті.
  if (t.breaker.isOpen()) {
    console.error(`❌ Skipped auth code email to ${toEmail}: ${t.breaker.error()}`);
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'AUTH_CODE_EMAIL_BLOCKED',
      message: `Користувачі не можуть увійти: коди авторизації не відправляються (${t.label} недоступний)`,
      details: { ...t.details(), recipient: toEmail, lastError: t.breaker.lastFailureMessage },
      dedupeKey: 'auth-code:circuit-open'
    });
    throw new Error('Поштовий сервер тимчасово недоступний. Спробуйте повторити вхід за хвилину або зверніться до адміністратора.');
  }

  try {
    if (t.sendCode) {
      await t.sendCode(toEmail, code);
    } else {
      await t.send({ to: toEmail, subject, html, text });
    }
    t.breaker.recordSuccess();
    console.log(`✅ Auth code email sent via ${t.label} to ${toEmail}`);
    return { success: true, simulated: false };
  } catch (err: any) {
    const reason = err?.message || 'Unknown error';
    t.breaker.recordFailure(reason);
    console.error(`❌ Failed to send auth code email to ${toEmail} via ${t.label}:`, reason);
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'AUTH_CODE_EMAIL_FAILED',
      message: `Код авторизації не доставлено — користувач не може увійти: ${reason}`,
      details: { ...t.details(), recipient: toEmail, reason, code: err?.code, command: err?.command },
      dedupeKey: `auth-code:${err?.code || reason}`
    });
    throw new Error(`Помилка відправки листа з кодом. Авторизація неможлива. Деталі: ${reason}`);
  }
}
