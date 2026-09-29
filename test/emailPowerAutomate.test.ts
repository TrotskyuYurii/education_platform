import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Відправка пошти через Power Automate (SMTP AUTH у тенанті M365 вимкнено).
 * Контракти flow ті самі, що й у IDL: зайвий ключ у тілі flow відхиляє, а URL
 * містить підпис доступу — він не має потрапити ні в помилку, ні в журнал.
 */
const capture = vi.fn();
vi.mock('../server/modules/system/service.js', () => ({ SystemLogService: { capture } }));

const OTP_URL = 'https://prod.example.logic.azure.com/workflows/otp/triggers/manual/paths/invoke?sig=SECRET-OTP';
const NOTIFY_URL = 'https://prod.example.logic.azure.com/workflows/notify/triggers/manual/paths/invoke?sig=SECRET-NOTIFY';
const ENV_KEYS = ['OTP_POWER_AUTOMATE_URL', 'OTP_POWER_AUTOMATE_SERVICE', 'NOTIFICATION_POWER_AUTOMATE_URL', 'SMTP_HOST'];

let fetchMock: ReturnType<typeof vi.fn>;
const saved: Record<string, string | undefined> = {};

async function loadEmail() {
  // Свіжий модуль на кожен тест: стан circuit breaker не переходить між тестами.
  vi.resetModules();
  return import('../server/email.js');
}

function lastBody(): Record<string, string> {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(init.body);
}

beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  fetchMock = vi.fn(async () => new Response('', { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  capture.mockClear();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('коди входу через Power Automate', () => {
  it('шле рівно { email, passcode, service } на OTP flow', async () => {
    process.env.OTP_POWER_AUTOMATE_URL = OTP_URL;
    const { sendAuthCodeEmail } = await loadEmail();

    const result = await sendAuthCodeEmail('a.kryhin@viatec.ua', 'AB23CD45');

    expect(result).toEqual({ success: true, simulated: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(OTP_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(lastBody()).toEqual({ email: 'a.kryhin@viatec.ua', passcode: 'AB23CD45', service: 'ep.viasecurity.tech' });
  });

  it('service береться з OTP_POWER_AUTOMATE_SERVICE', async () => {
    process.env.OTP_POWER_AUTOMATE_URL = OTP_URL;
    process.env.OTP_POWER_AUTOMATE_SERVICE = 'portal.test';
    const { sendAuthCodeEmail } = await loadEmail();

    await sendAuthCodeEmail('user@viatec.ua', 'ZZ23CD45');

    expect(lastBody().service).toBe('portal.test');
  });

  it('помилка flow кидає виняток без URL і підпису', async () => {
    process.env.OTP_POWER_AUTOMATE_URL = OTP_URL;
    fetchMock.mockResolvedValue(new Response('{"error":"InvalidTemplate"}', { status: 400 }));
    const { sendAuthCodeEmail } = await loadEmail();

    const err = await sendAuthCodeEmail('user@viatec.ua', 'AB23CD45').catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('HTTP 400');
    expect(err.message).not.toContain('SECRET');
    expect(err.message).not.toContain('logic.azure.com');
    expect(JSON.stringify(capture.mock.calls)).not.toContain('SECRET');
  });

  it('без жодного транспорту — зрозуміла помилка, запиту немає', async () => {
    const { sendAuthCodeEmail } = await loadEmail();

    await expect(sendAuthCodeEmail('user@viatec.ua', 'AB23CD45')).rejects.toThrow(/не налаштовано/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('сповіщення через Power Automate', () => {
  it('шле рівно { email, subject, body } з HTML у body', async () => {
    process.env.NOTIFICATION_POWER_AUTOMATE_URL = NOTIFY_URL;
    const { sendEmail } = await loadEmail();

    const result = await sendEmail('user@viatec.ua', 'Нове призначення', '<p>Курс <b>Каса</b></p>', 'Курс Каса');

    expect(result).toEqual({ success: true });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(NOTIFY_URL);
    expect(lastBody()).toEqual({ email: 'user@viatec.ua', subject: 'Нове призначення', body: '<p>Курс <b>Каса</b></p>' });
  });

  it('OTP і сповіщення ходять у різні flow', async () => {
    process.env.OTP_POWER_AUTOMATE_URL = OTP_URL;
    process.env.NOTIFICATION_POWER_AUTOMATE_URL = NOTIFY_URL;
    const { sendEmail, sendAuthCodeEmail } = await loadEmail();

    await sendEmail('user@viatec.ua', 'S', '<p>x</p>');
    await sendAuthCodeEmail('user@viatec.ua', 'AB23CD45');

    expect(fetchMock.mock.calls.map(c => c[0])).toEqual([NOTIFY_URL, OTP_URL]);
  });

  it('помилка не кидає виняток і не розкриває URL', async () => {
    process.env.NOTIFICATION_POWER_AUTOMATE_URL = NOTIFY_URL;
    fetchMock.mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }));
    const { sendEmail } = await loadEmail();

    const result = await sendEmail('user@viatec.ua', 'S', '<p>x</p>');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Power Automate: ECONNRESET');
    expect(JSON.stringify(capture.mock.calls)).not.toContain('SECRET');
  });

  it('після трьох збоїв поспіль circuit відсікає відправку без запиту', async () => {
    process.env.NOTIFICATION_POWER_AUTOMATE_URL = NOTIFY_URL;
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const { sendEmail, isEmailCircuitOpen } = await loadEmail();

    for (let i = 0; i < 3; i++) await sendEmail('user@viatec.ua', 'S', '<p>x</p>');
    expect(isEmailCircuitOpen()).toBe(true);

    const result = await sendEmail('user@viatec.ua', 'S', '<p>x</p>');
    expect(result.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('збій flow сповіщень не блокує коди входу', async () => {
    process.env.OTP_POWER_AUTOMATE_URL = OTP_URL;
    process.env.NOTIFICATION_POWER_AUTOMATE_URL = NOTIFY_URL;
    fetchMock.mockImplementation(async (url: string) =>
      new Response('', { status: url === NOTIFY_URL ? 500 : 202 }));
    const { sendEmail, sendAuthCodeEmail } = await loadEmail();

    for (let i = 0; i < 3; i++) await sendEmail('user@viatec.ua', 'S', '<p>x</p>');

    await expect(sendAuthCodeEmail('user@viatec.ua', 'AB23CD45')).resolves.toEqual({ success: true, simulated: false });
  });
});
