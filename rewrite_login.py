import re

with open('src/components/LoginScreen.tsx', 'r') as f:
    content = f.read()

# Replace step state
content = content.replace("useState<'credentials' | 'code'>('credentials');", "useState<'email' | 'password' | 'code'>('email');")
content = content.replace("step === 'credentials'", "step === 'email' || step === 'password'")

# We'll just replace the handleCredentialsSubmit entirely
handle_cred = """  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const cleanEmail = email.trim().toLowerCase();
    
    if (cleanEmail !== 'admin' && !cleanEmail.endsWith('@viatec.ua')) {
      setError('Вхід дозволено лише з корпоративної пошти у домені @viatec.ua');
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
      } else if (data.success) {
        login(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Помилка з\\'єднання з сервером');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const cleanEmail = email.trim().toLowerCase();
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

      if (data.success) {
        login(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Помилка з\\'єднання з сервером');
    } finally {
      setLoading(false);
    }
  };"""

# Replace the old handleCredentialsSubmit
start = content.find("const handleCredentialsSubmit = async")
end = content.find("const handleCodeSubmit = async", start)
content = content[:start] + handle_cred + "\n\n  " + content[end:]


jsx_form_old = """          {step === 'email' || step === 'password' ? (
            /* STEP 1: Email and Password Form */
            <form className="space-y-5" onSubmit={handleCredentialsSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Корпоративний Email (@viatec.ua)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="user@viatec.ua (або admin для першого запуску)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Дозволяється вхід лише для співробітників компанії
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Пароль
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-50"
                >
                  {loading ? 'Перевірка даних...' : 'Увійти'}
                </button>
              </div>
            </form>"""

jsx_form_new = """          {step === 'email' ? (
            /* STEP 1: Email Form */
            <form className="space-y-5" onSubmit={handleEmailSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Корпоративний Email (@viatec.ua)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="user@viatec.ua (або admin для першого запуску)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Дозволяється вхід лише для співробітників компанії
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
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">{email}</p>
              </div>
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
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
            </form>"""

content = content.replace(jsx_form_old, jsx_form_new)
content = content.replace("setStep('credentials');", "setStep('email');")
content = content.replace("<span>Повернутися до вводу пароля</span>", "<span>Повернутися назад</span>")

with open('src/components/LoginScreen.tsx', 'w') as f:
    f.write(content)

