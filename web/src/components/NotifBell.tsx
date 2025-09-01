import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, X } from 'lucide-react';
import { api } from '../lib/api';

// ➕ Agregamos british al LastSeen (front-only)
type LastSeen = {
  comms?: string | Date;
  partials?: string | Date;
  reportcards?: string | Date;
  british?: string | Date;
};

type Counts = { communications: number; partials: number; reportcards: number; total: number };

const KEY = 'notif.lastSeen';

function loadLastSeen(): LastSeen {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}
function saveLastSeen(v: LastSeen) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
}

export default function NotifBell({ onClick }: { onClick?: () => void }) {
  const [open, setOpen] = useState(false);
  const [markedOnOpen, setMarkedOnOpen] = useState(false);
  const lastSeen = loadLastSeen();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Base del agregador (comms/partials/reportcards)
  const baseQ = useQuery<Counts>({
    queryKey: [
      'notif-counts',
      lastSeen.comms ?? null,
      lastSeen.partials ?? null,
      lastSeen.reportcards ?? null,
    ],
    queryFn: () => api.notifications.countsSince(lastSeen),
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 1,
  });

  // ➕ British: contamos updatedAt > lastSeen.british
  const britishQ = useQuery({
    queryKey: ['british-mine', lastSeen.british ?? null],
    queryFn: async () => {
      try { const res = await api.british.mine(); return res?.results || []; }
      catch { return []; }
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 1,
  });

  let britishNew = 0;
  try {
    const since = lastSeen.british ? new Date(lastSeen.british) : new Date(0);
    britishNew = (britishQ.data || []).filter((r: any) => r?.updatedAt && new Date(r.updatedAt) > since).length;
  } catch {}

  const total = (baseQ.data?.total ?? 0) + britishNew;

  // Cerrar al click afuera
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!open) return;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Marcar como visto cuando se abre el panel por primera vez
  useEffect(() => {
    if (open && !markedOnOpen) {
      const now = new Date().toISOString();
      saveLastSeen({ comms: now, partials: now, reportcards: now, british: now });
      setMarkedOnOpen(true);
    }
  }, [open, markedOnOpen]);

  const toggle = () => setOpen(v => !v);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        className="relative btn btn-secondary !px-3 !py-2"
        aria-label="Notificaciones"
        title={total > 0 ? `${total} novedades` : 'Notificaciones'}
        onClick={toggle}
      >
        <Bell size={18} />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-pink-600 text-white text-[10px] px-1.5 py-0.5 min-w-[1.2rem] text-center leading-none">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-72 rounded-2xl border bg-white shadow-lg p-2 z-50 text-sm"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <div className="font-medium">Novedades</div>
            <button className="rounded-md p-1 hover:bg-neutral-100" onClick={() => setOpen(false)} aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>

          <div className="divide-y">
            <div className="p-2">
              {(baseQ.data?.communications ?? 0) > 0
                ? <div>📩 Tenés <b>{baseQ.data!.communications}</b> comunicación(es) nueva(s).</div>
                : <div className="text-neutral-500">📩 Sin comunicaciones nuevas.</div>}
            </div>
            <div className="p-2">
              {(baseQ.data?.partials ?? 0) > 0
                ? <div>📝 Hay <b>{baseQ.data!.partials}</b> parcial(es) actualizado(s).</div>
                : <div className="text-neutral-500">📝 Sin cambios en parciales.</div>}
            </div>
            <div className="p-2">
              {(baseQ.data?.reportcards ?? 0) > 0
                ? <div>📊 Boletín: <b>{baseQ.data!.reportcards}</b> cambio(s) nuevo(s).</div>
                : <div className="text-neutral-500">📊 Sin cambios en boletín.</div>}
            </div>
            <div className="p-2">
              {britishNew > 0
                ? <div>🇬🇧 British: <b>{britishNew}</b> resultado(s) nuevo(s)/actualizado(s).</div>
                : <div className="text-neutral-500">🇬🇧 Sin cambios en British.</div>}
            </div>
          </div>

          {/* Acciones rápidas (links simples) */}
          <div className="grid grid-cols-2 gap-2 p-2">
            <a className="btn btn-secondary !py-1 text-center" href="/student/communications">Ver comunicaciones</a>
            <a className="btn btn-secondary !py-1 text-center" href="/student/partials">Ver parciales</a>
            <a className="btn btn-secondary !py-1 text-center" href="/student/finals">Ver boletín</a>
            <a className="btn btn-secondary !py-1 text-center" href="/student/british">Ver British</a>
          </div>

          {/* Atajo para staff (sin romper UI si no existe) */}
          <div className="px-2 pb-2">
            <a className="text-xs text-pink-700 hover:underline" href="/communications">Panel de comunicaciones (staff)</a>
          </div>

          {/* Mantengo compat: un botón que dispara onClick (tu navegación original) */}
          <div className="px-2 pb-2">
            <button
              className="text-xs text-neutral-600 hover:underline"
              onClick={() => { onClick?.(); setOpen(false); }}
            >
              Ir al panel que uses por defecto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
