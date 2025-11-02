// web/src/main.tsx
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 👇 Tus estilos globales
import './index.css';              // carga Tailwind y estilos base
import './styles/dark-fixes.css';  // fixes para modo oscuro (dejarlo después de index.css)

// ⬇️ React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 👇 Inicializa el tema en <html> al arrancar (oscuro/claro)
import { initTheme } from './theme';
initTheme(); // <- importante para que en móvil el fondo no quede claro

// Cliente global de React Query (no cambia tu lógica de datos)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

class Boundary extends React.Component<
  React.PropsWithChildren<{}>,
  { error: unknown }
> {
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
      {/* ⬇️ Proveedor requerido por useQuery/useMutation */}
      <QueryClientProvider client={queryClient}>
        <App />
        {/* Devtools opcional (solo en desarrollo) */}
      </QueryClientProvider>
    </Boundary>
  </StrictMode>
);

