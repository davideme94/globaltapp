import { useEffect, useMemo, useState } from 'react';
import { api, type Communication } from '../lib/api';

// Mapa con categorías + alias por si llegan variantes viejas
const CAT_MAP: Record<string, { name: string; color: string }> = {
  TASK:       { name: 'Tarea',         color: '#0ea5e9' },
  TASKS:      { name: 'Tarea',         color: '#0ea5e9' },
  BEHAVIOR:   { name: 'Conducta',      color: '#ef4444' },
  BEHAVIOUR:  { name: 'Conducta',      color: '#ef4444' },
  ADMIN:      { name: 'Administrativa',color: '#8b5cf6' },
  ADMINISTRATIVE:{ name: 'Administrativa', color: '#8b5cf6' },
  INFO:       { name: 'Información',   color: '#10b981' },
};

// fallback para categorías desconocidas o undefined
const DEFAULT_TAG = { name: 'Mensaje', color: '#64748b' };

function normalizeCategory(raw?: string | null) {
  if (!raw) return DEFAULT_TAG;
  const key = String(raw).toUpperCase();
  return CAT_MAP[key] ?? DEFAULT_TAG;
}

function Item({ c, onRead }: { c: Communication; onRead: (id: string) => void }) {
  const created = c.createdAt ? new Date(c.createdAt) : null;
  const tag = normalizeCategory((c as any).category);

  const read = !!c.readAt;
  const courseName =
    typeof c.course === 'string' ? '' : `${c.course.name} (${c.course.year})`;
  const senderName = typeof c.sender === 'string' ? '' : c.sender?.name || '';

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 12,
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              background: tag.color,
              color: '#fff',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {tag.name}
          </span>
          <b>{c.title || '(Sin asunto)'}</b>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <small>
            {created
              ? `${created.toLocaleDateString()} ${created.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : ''}
          </small>
          {!read && (
            <button onClick={() => onRead(c._id)} aria-label="Marcar leído">
              Marcar leído
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{c.body || ''}</div>

      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
        {courseName ? <>Curso: {courseName} — </> : null}
        {senderName ? <>Enviado por: {senderName}</> : null}
      </div>
    </div>
  );
}

export default function StudentCommunications() {
  const [rows, setRows] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.communications.mine();
      // orden defensivo por fecha
      const ordered = r.rows.slice().sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
      setRows(ordered);
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'Error al cargar comunicaciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unread = useMemo(() => rows.filter((r) => !r.readAt).length, [rows]);

  async function markRead(id: string) {
    try {
      await api.communications.markRead(id);
    } finally {
      await load();
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Cargando…</div>;

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 900 }}>
      <h1>
        Libro de comunicaciones{' '}
        {unread ? <small style={{ color: '#ef4444' }}>({unread} sin leer)</small> : null}
      </h1>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      {rows.length === 0 ? (
        <p>Aún no hay mensajes.</p>
      ) : (
        rows.map((r) => <Item key={r._id} c={r} onRead={markRead} />)
      )}
    </div>
  );
}
