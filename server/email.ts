import nodemailer from 'nodemailer';

let transporter: any = null;

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
    return { success: false, error: 'SMTP not configured' };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || '"ВІАТЕК Безпека" <no-reply@viatec.ua>',
      to: toEmail,
      subject,
      text: text || subject,
      html,
    });
    return { success: true };
  } catch (err: any) {
    console.error(`❌ Failed to send notification email to ${toEmail}:`, err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
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
  if (t) {
    try {
      await t.sendMail({
        from: process.env.SMTP_FROM || '"ВІАТЕК Безпека" <no-reply@viatec.ua>',
        to: toEmail,
        subject,
        text,
        html,
      });
      console.log(`✅ Real email successfully sent via SMTP to ${toEmail}`);
      return { success: true, simulated: false };
    } catch (err: any) {
      console.error(`❌ Failed to send SMTP email to ${toEmail}:`, err);
      throw new Error(`Помилка відправки листа з кодом. Авторизація неможлива. Деталі: ${err.message}`);
    }
  }

  // Security Policy: Never allow simulated code access if SMTP is missing or fails
  console.error(`❌ Failed to send auth code to ${toEmail} because SMTP is not configured.`);
  throw new Error('Поштовий сервер (SMTP) не налаштовано. Відправка коду та авторизація тимчасово недоступні. Зверніться до адміністратора.');
}
