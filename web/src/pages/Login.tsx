import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('teacher@globalt.test');
  const [password, setPassword] = useState('123456');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // === Tema: estado + persistencia ===
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(email, password);
      nav('/communications', { replace: true });
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || 'Error de login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="relative w-full max-w-md p-[1px] rounded-2xl 
                      bg-gradient-to-br from-fuchsia-500/70 to-indigo-600/70 shadow-2xl">
        <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur p-6 md:p-8">
          {/* Header del card: título + toggle visible */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Login</h1>
            <button
              type="button"
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm
                         hover:bg-neutral-100 dark:hover:bg-slate-800 focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary"
              aria-label="Cambiar tema"
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            >
              <span aria-hidden>🌓</span>
              <span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
            </button>
          </div>

          <form onSubmit={doLogin} className="space-y-4">
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" />
              <input
                className="input pl-10 pr-3"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="profe@inst.test"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" />
              <input
                className="input pl-10 pr-10"
                type={showPwd ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700"
              >
                {showPwd ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando…' : 'Entrar'}
            </button>

            {error && (
              <div id="login-error" role="alert" className="alert alert-error">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
