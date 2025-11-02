// web/src/theme.ts
export type ThemeMode = 'light' | 'dark';

export function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark';
  // ⚠️ clave: setear en <html>
  document.documentElement.classList.toggle('dark', isDark);
  // opcional mantener en <body> si ya lo usabas
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('theme', mode);
}

export function initTheme() {
  const stored = (localStorage.getItem('theme') as ThemeMode | null);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored ?? (prefersDark ? 'dark' : 'light'));
}
