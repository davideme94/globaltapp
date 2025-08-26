import { useState } from 'react';
import { login } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('teacher@globalt.test'); // arranco con teacher
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      // refresco la app para que /auth/me muestre el nuevo usuario
      nav('/communications', { replace: true });
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error de login');
    } finally {
      setLoading(false);
    }
  };

  const setQuick = (who: 'coor' | 'teacher' | 'student') => {
    if (who === 'coor') setEmail('coor@globalt.test');
    if (who === 'teacher') setEmail('teacher@globalt.test');
    if (who === 'student') setEmail('alumno1@globalt.test');
    setPassword('123456');
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 16 }}>
      <h2>Login</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setQuick('coor')}>Cargar Coordinador</button>
        <button type="button" onClick={() => setQuick('teacher')}>Cargar Docente</button>
        <button type="button" onClick={() => setQuick('student')}>Cargar Alumno</button>
      </div>

      <form onSubmit={doLogin} style={{ display: 'grid', gap: 8 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <p style={{ marginTop: 12 }}>
        Usuarios del seed: <code>coor@globalt.test</code>, <code>teacher@globalt.test</code>, <code>alumno1@globalt.test</code><br />
        Contraseña: <code>123456</code>
      </p>
    </div>
  );
}
