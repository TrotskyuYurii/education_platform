import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, KeyRound, ArrowLeft, RefreshCw, AlertCircle, ShieldCheck, Eye, EyeOff, Clock } from 'lucide-react';

const EMAIL_DOMAIN = '@viatec.ua';
const ADMIN_LOGIN = 'admin';

/** Залишає лише локальну частину логіну: прибирає пробіли та все після '@' (зручно для вставки повної адреси). */
const sanitizeLocalPart = (value: string) => value.replace(/\s+/g, '').split('@')[0].toLowerCase();

/** Збирає повну адресу з локальної частини; 'admin' лишається службовим логіном без домену. */
const buildEmail = (value: string) => {
  const local = sanitizeLocalPart(value);
  if (!local) return '';
  return local === ADMIN_LOGIN ? ADMIN_LOGIN : `${local}${EMAIL_DOMAIN}`;
};

export const LoginScreen: React.FC = () => {
  const { login, sessionExpired, dismissSessionExpired } = useAuth();
  
  // Step: 'credentials' | 'code'
  const [step, setStep] = useState<'email' | 'password' | 'code'>('email');
  
  // Step 1: Credentials (користувач вводить лише локальну частину, домен додається автоматично)
  const [emailLocal, setEmailLocal] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Step 2: Verification code
  const [authCode, setAuthCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes in seconds
  const [debugCode, setDebugCode] = useState<string | undefined>(undefined);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);

  const isAdminLogin = sanitizeLocalPart(emailLocal) === ADMIN_LOGIN;
  const fullEmail = buildEmail(emailLocal);

  // Timer countdown for code expiration
  useEffect(() => {
    if (step !== 'code' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-focus code input when step changes to 'code'
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 150);
    }
  }, [step]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

    const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    // Пояснення про автоматичний вихід більше не актуальне, щойно людина входить знову.
    dismissSessionExpired();

    const cleanEmail = fullEmail;

    if (!cleanEmail) {
      setError("Введіть ім'я користувача корпоративної пошти");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Помилка');
      }

      if (data.requirePassword) {
        setStep('password');
      } else if (data.requireOtp || data.requireEmailCode) {
        setPendingEmail(data.email || cleanEmail);
        setTimeLeft(data.expiresInSeconds || 300);
        setDebugCode(data.debugCode);
        if (data.message) setInfoMsg(data.message);
        setAuthCode('');
        setStep('code');
        setResendCooldown(30);
      } else if (data.success || data.user) {
        login(data.user, data.session);
      }
    } catch (err: any) {
      setError(err.message || 'Помилка з\'єднання з сервером');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const cleanEmail = fullEmail;
    if (!password) {
      setError('Введіть пароль');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Помилка авторизації');
      }

      if (data.success || data.user) {
        login(data.user, data.session);
      }
    } catch (err: any) {
      setError(err.message || 'Помилка з\'єднання з сервером');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const cleanCode = authCode.trim().toUpperCase();
    if (cleanCode.length !== 8) {
      setError('Код авторизації повинен містити рівно 8 знаків');
      return;
    }

    if (timeLeft <= 0) {
      setError('Термін дії коду вичерпано. Натисніть «Надіслати код повторно» для отримання нового.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code: cleanCode })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Невірний або прострочений код');
      }

      login(data.user, data.session);
    } catch (err: any) {
      setError(err.message || 'Помилка перевірки коду');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Не вдалося надіслати код повторно');
      }

      setTimeLeft(data.expiresInSeconds || 300);
      setDebugCode(data.debugCode);
      setAuthCode('');
      setResendCooldown(30);
      setInfoMsg(`Новий код надіслано на ${pendingEmail}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('email');
    setAuthCode('');
    setError('');
    setInfoMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/25">
          {step === 'email' || step === 'password' ? (
            <Lock className="w-8 h-8 text-white" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-white" />
          )}
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Портал ВІАТЕК
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Корпоративна система регламентів, навчання та тестування
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm sm:rounded-2xl border border-slate-200">
          
          {sessionExpired && !error && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium flex items-start gap-2.5">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <span>Сесію завершено через тривалу бездіяльність. Увійдіть знову, щоб продовжити роботу.</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-start gap-2.5">
              <Mail className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {step === 'email' ? (
            /* STEP 1: Email Form */
            <form className="space-y-5" onSubmit={handleEmailSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Корпоративний Email
                </label>
                <div className="flex items-stretch w-full bg-white border border-slate-300 rounded-xl shadow-xs transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <div className="pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    spellCheck={false}
                    placeholder="ім'я.прізвище"
                    value={emailLocal}
                    onChange={(e) => setEmailLocal(sanitizeLocalPart(e.target.value))}
                    className="flex-1 min-w-0 appearance-none bg-transparent pl-2.5 pr-1 py-2.5 border-0 rounded-l-xl placeholder-slate-400 focus:outline-none focus:ring-0 sm:text-sm"
                  />
                  {!isAdminLogin && (
                    <span className="flex items-center pr-3.5 pl-0.5 text-sm font-medium text-slate-500 select-none whitespace-nowrap">
                      {EMAIL_DOMAIN}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Домен <strong className="font-semibold text-slate-600">@viatec.ua</strong> підставляється автоматично — введіть лише ім'я користувача
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-50"
                >
                  {loading ? 'Зачекайте...' : 'Далі'}
                </button>
              </div>
            </form>
          ) : step === 'password' ? (
            /* STEP 1.5: Password Form */
            <form className="space-y-5" onSubmit={handlePasswordSubmit}>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Введіть пароль</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">{fullEmail}</p>
              </div>
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    title={showPassword ? "Приховати пароль" : "Показати пароль"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-50"
                >
                  {loading ? 'Перевірка...' : 'Увійти'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Повернутися до вводу email</span>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: 8-Character Authorization Code */
            <form className="space-y-5" onSubmit={handleCodeSubmit}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-600 rounded-full mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Підтвердження входу
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  На адресу <strong className="text-slate-800">{pendingEmail}</strong> надіслано одноразовий код авторизації (8 знаків).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider text-center">
                  Введіть 8-значний код
                </label>
                <div className="relative">
                  <input
                    ref={codeInputRef}
                    type={showCode ? "text" : "password"}
                    maxLength={8}
                    required
                    autoComplete="one-time-code"
                    placeholder="••••••••"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
                    className="block w-full py-3 px-10 text-center font-mono text-2xl font-bold tracking-[0.35em] text-slate-800 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none uppercase placeholder:text-slate-300 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    title={showCode ? "Приховати код" : "Показати код"}
                  >
                    {showCode ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className={`font-semibold flex items-center gap-1 ${timeLeft <= 30 ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`}>
                    ⏱️ Термін дії: {formatTimer(timeLeft)}
                  </span>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || loading}
                    className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{resendCooldown > 0 ? `Повтор через ${resendCooldown}с` : 'Надіслати знову'}</span>
                  </button>
                </div>
              </div>

              {debugCode && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                  <span className="text-base">💡</span>
                  <div>
                    <div className="font-semibold text-blue-800">Тестове середовище (код з пошти):</div>
                    <div className="mt-0.5 font-mono text-sm font-extrabold text-blue-600 tracking-wider">
                      {debugCode}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={loading || authCode.trim().length !== 8 || timeLeft <= 0}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-50"
                >
                  {loading ? 'Перевірка коду...' : 'Підтвердити та увійти'}
                </button>

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Повернутися назад</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
