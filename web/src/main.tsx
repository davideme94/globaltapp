// web/src/main.tsx
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 👇 Tus estilos globales
import './index.css';
import './styles/dark-fixes.css';

// ⬇️ React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 🔆 Forzar modo claro SIEMPRE (evita auto-dark en móvil / WebView / Chrome)
(function forceLight() {
  const html = document.documentElement; // <html>
  html.classList.add('force-light');     // <- clave para bloquear preferencia del SO
  html.classList.remove('dark');         // por si estaba seteado en algún lado

  // meta color-scheme => le dice al motor que la página es light
  let metaCS = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  if (!metaCS) {
    metaCS = document.createElement('meta');
    metaCS.setAttribute('name', 'color-scheme');
    document.head.appendChild(metaCS);
  }
  metaCS.setAttribute('content', 'light');

  // meta theme-color => barra del navegador clara en Android/Chrome
  let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.setAttribute('name', 'theme-color');
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', '#ffffff');
})();

// Cliente global de React Query (igual que tenías)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

class Boundary extends React.Component<React.PropsWithChildren<{}>, { error: unknown }> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown, info: unknown) {
    console.error('[App crash]', error, info);
  }
  render() {
    if (this.state.error) {
      const msg = (this.state.error as any)?.message ?? String(this.state.error);
      return (
        <div style={{ padding: 16 }}>
          <h1>Error en la UI</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{msg}</pre>
        </div>
      );
    }
    return this.props.children as React.ReactNode;
  }
}

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <Boundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Boundary>
  </StrictMode>
);
