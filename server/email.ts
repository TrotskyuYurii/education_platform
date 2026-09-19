import nodemailer from 'nodemailer';
import { SystemLogService } from './modules/system/service.js';

let transporter: any = null;

/* ------------------------------------------------------------------ *
 * Запобіжники навколо SMTP
 *
 * Невдала відправка листа не має ані блокувати HTTP-запит, ані з'їдати
 * ресурси процесу. Тому тут три механізми:
 *   1) circuit breaker — після кількох поспіль невдач подальші спроби
 *      відсікаються миттєво (0 мс), поки не мине cooldown;
 *   2) обмежувач паралельності — масова розсилка не відкриє сотні
 *      сокетів, які висітимуть до таймауту;
 *   3) pool — з'єднання перевикористовуються замість handshake на лист.
 * ------------------------------------------------------------------ */

const FAILURE_THRESHOLD = 3;          // скільки невдач поспіль відкривають circuit
const BASE_COOLDOWN_MS = 60_000;      // перший період «тиші»
const MAX_COOLDOWN_MS = 15 * 60_000;  // стеля експоненційного відкату
const MAX_CONCURRENT_SENDS = 2;       // одночасних sendMail (== maxConnections пулу)
const MAX_QUEUE_LENGTH = 200;         // понад це — лист відкидається, а не накопичується

let consecutiveFailures = 0;
let circuitOpenUntil = 0;
let lastFailureMessage = '';
let currentCooldownMs = BASE_COOLDOWN_MS;

const circuitIsOpen = (): boolean => Date.now() < circuitOpenUntil;

/**
 * Чи відсічена зараз відправка. Фонові розсилки (дайджест) використовують це,
 * щоб не проганяти сотні листів по мертвому SMTP, а відкласти їх на наступний прогін.
 */
export const isEmailCircuitOpen = (): boolean => circuitIsOpen();

const circuitError = (): string =>
  `SMTP недоступний, спроби призупинено ще на ${Math.ceil((circuitOpenUntil - Date.now()) / 1000)} с`;

function recordSuccess(): void {
  if (consecutiveFailures > 0) {
    console.log('✉️ SMTP відновився, лічильник невдач скинуто');
  }
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
  currentCooldownMs = BASE_COOLDOWN_MS;
}

function recordFailure(errorMessage?: string): void {
  if (errorMessage) lastFailureMessage = errorMessage;
  // Це пробна спроба після cooldown, а не чергова помилка з одного залпу?
  const failedProbe = circuitOpenUntil > 0 && Date.now() >= circuitOpenUntil;
  consecutiveFailures += 1;
  if (consecutiveFailures < FAILURE_THRESHOLD) return;

  // Відкат росте лише тоді, коли впав саме пробний лист після паузи.
  // Інакше одна масова розсилка за мілісекунди розігнала б паузу до стелі.
  if (failedProbe) {
    currentCooldownMs = Math.min(currentCooldownMs * 2, MAX_COOLDOWN_MS);
  }
  if (Date.now() >= circuitOpenUntil) {
    circuitOpenUntil = Date.now() + currentCooldownMs;
    console.warn(
      `⚠️ SMTP: ${consecutiveFailures} невдач поспіль — відправку призупинено на ${currentCooldownMs / 1000} с`
    );
    // Окремий запис у журналі: це вже не «один лист не дійшов», а пошта лежить —
    // саме це адміністратор має побачити першим.
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'SMTP_CIRCUIT_OPEN',
      message: `Поштовий сервер не відповідає: ${consecutiveFailures} невдач поспіль, відправку призупинено на ${Math.round(currentCooldownMs / 1000)} с`,
      details: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || '587',
        consecutiveFailures,
        cooldownSeconds: Math.round(currentCooldownMs / 1000),
        lastError: lastFailureMessage
      },
      dedupeKey: 'smtp-circuit-open'
    });
  }
}

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

export function getEmailTransporter(): any {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  if (host) {
    try {
      transporter = nodemailer.createTransport({
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
      transporter.on?.('error', (err: any) => {
        console.error('⚠️ SMTP pool error:', err?.message || err);
      });
      console.log(`✉️ SMTP Transporter initialized for host: ${host}`);
    } catch (err) {
      console.error('⚠️ Failed to initialize SMTP Transporter:', err);
      transporter = null;
    }
  }
  return transporter;
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
 * throws — a notification email failing (or SMTP being unconfigured) must not
 * break the in-app flow that triggered it, it should just be logged and skipped.
 *
 * Крім того, воно ніколи не «висить»: якщо circuit breaker відкритий (SMTP уже
 * впав кілька разів поспіль) або черга переповнена, функція повертається миттєво.
 */
export async function sendEmail(
  toEmail: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; error?: string }> {
  const t = getEmailTransporter();
  if (!t) {
    console.warn(`✉️ Skipped notification email to ${toEmail} (SMTP not configured): ${subject}`);
    SystemLogService.capture({
      level: 'warning',
      source: 'email',
      event: 'SMTP_NOT_CONFIGURED',
      message: 'Поштовий сервер (SMTP) не налаштовано — листи сповіщень не відправляються',
      details: { lastRecipient: toEmail, subject, hint: 'Задайте змінні SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS' },
      dedupeKey: 'smtp-not-configured'
    });
    return { success: false, error: 'SMTP not configured' };
  }
  if (circuitIsOpen()) {
    console.warn(`✉️ Skipped notification email to ${toEmail}: ${circuitError()}`);
    return { success: false, error: circuitError() };
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
    // Поки лист чекав у черзі, SMTP міг впасти — перевіряємо ще раз, щоб не
    // витрачати ще один таймаут на завідомо мертвий сервер.
    if (circuitIsOpen()) {
      return { success: false, error: circuitError() };
    }
    await t.sendMail({
      from: process.env.SMTP_FROM || '"ВІАТЕК Безпека" <no-reply@viatec.ua>',
      to: toEmail,
      subject,
      text: text || subject,
      html,
    });
    recordSuccess();
    return { success: true };
  } catch (err: any) {
    const reason = err?.message || 'Unknown error';
    recordFailure(reason);
    console.error(`❌ Failed to send notification email to ${toEmail}:`, reason);
    // Журнал адміністратора: дедуплікуємо за причиною, а не за адресатом — одна
    // масова розсилка по мертвому SMTP має дати один рядок із лічильником.
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'EMAIL_SEND_FAILED',
      message: `Не вдалося надіслати лист сповіщення: ${reason}`,
      details: { lastRecipient: toEmail, subject, reason, code: err?.code, command: err?.command },
      dedupeKey: `send-failed:${err?.code || reason}`
    });
    return { success: false, error: reason };
  } finally {
    releaseSlot();
  }
}

/**
 * Fire-and-forget обгортка над sendEmail для викликів усередині обробників
 * запитів: повертає керування синхронно, тож жоден HTTP-запит не чекає на SMTP.
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

  const t = getEmailTransporter();
  if (!t) {
    // Security Policy: Never allow simulated code access if SMTP is missing or fails
    console.error(`❌ Failed to send auth code to ${toEmail} because SMTP is not configured.`);
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'AUTH_CODE_EMAIL_FAILED',
      message: 'Код авторизації не відправлено: поштовий сервер (SMTP) не налаштовано — вхід для користувачів заблоковано',
      details: { recipient: toEmail, hint: 'Задайте змінні SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS' },
      dedupeKey: 'auth-code:not-configured'
    });
    throw new Error('Поштовий сервер (SMTP) не налаштовано. Відправка коду та авторизація тимчасово недоступні. Зверніться до адміністратора.');
  }

  // Лист із кодом — єдиний, на який користувач реально чекає, тож він іде повз
  // чергу сповіщень (нічний дайджест не має затримувати вхід). Але circuit
  // breaker діє і тут: якщо SMTP щойно впав тричі поспіль, краще одразу віддати
  // зрозумілу помилку, ніж тримати форму входу ще 20 секунд на таймауті.
  if (circuitIsOpen()) {
    console.error(`❌ Skipped auth code email to ${toEmail}: ${circuitError()}`);
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'AUTH_CODE_EMAIL_BLOCKED',
      message: 'Користувачі не можуть увійти: коди авторизації не відправляються через недоступний SMTP',
      details: { recipient: toEmail, lastError: lastFailureMessage, host: process.env.SMTP_HOST },
      dedupeKey: 'auth-code:circuit-open'
    });
    throw new Error('Поштовий сервер тимчасово недоступний. Спробуйте повторити вхід за хвилину або зверніться до адміністратора.');
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || '"ВІАТЕК Безпека" <no-reply@viatec.ua>',
      to: toEmail,
      subject,
      text,
      html,
    });
    recordSuccess();
    console.log(`✅ Real email successfully sent via SMTP to ${toEmail}`);
    return { success: true, simulated: false };
  } catch (err: any) {
    const reason = err?.message || 'Unknown error';
    recordFailure(reason);
    console.error(`❌ Failed to send SMTP email to ${toEmail}:`, reason);
    SystemLogService.capture({
      level: 'error',
      source: 'email',
      event: 'AUTH_CODE_EMAIL_FAILED',
      message: `Код авторизації не доставлено — користувач не може увійти: ${reason}`,
      details: { recipient: toEmail, reason, code: err?.code, command: err?.command, host: process.env.SMTP_HOST },
      dedupeKey: `auth-code:${err?.code || reason}`
    });
    throw new Error(`Помилка відправки листа з кодом. Авторизація неможлива. Деталі: ${reason}`);
  }
}
