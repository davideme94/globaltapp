// web/src/main.tsx
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // 👈 IMPORTANTE: carga Tailwind y tus estilos

// ⬇️ React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
      {/* ⬇️ Proveedor requerido por useQuery/useMutation */}
      <QueryClientProvider client={queryClient}>
        <App />
        {/* Devtools opcional (solo en desarrollo) */}
      </QueryClientProvider>
    </Boundary>
  </StrictMode>
);
