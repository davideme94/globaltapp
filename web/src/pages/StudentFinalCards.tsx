import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ReportCard, type Me } from '../lib/api';

/* ---------- UI helpers ---------- */
function Badge({ c }: { c: ReportCard['condition'] }) {
  const txt: any = {
    APPROVED: 'Aprobado',
    FAILED_ORAL: 'Desaprobado (oral)',
    FAILED_WRITTEN: 'Desaprobado (escrito)',
    FAILED_BOTH: 'Desaprobado (ambos)',
    PASSED_INTERNAL: 'Pasó con examen interno',
    REPEATER: 'Repitente',
  };
  const color: any = {
    APPROVED: '#10b981',
    FAILED_ORAL: '#ef4444',
    FAILED_WRITTEN: '#ef4444',
    FAILED_BOTH: '#ef4444',
    PASSED_INTERNAL: '#0ea5e9',
    REPEATER: '#f59e0b',
  };
  return (
    <span
      style={{
        background: color[c],
        color: '#fff',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {txt[c] || c}
    </span>
  );
}

function val(v: number | null | undefined) {
  return typeof v === 'number' ? v : '—';
}
function avg3(a?: number | null, b?: number | null, c?: number | null) {
  const xs = [a, b, c].filter((n): n is number => typeof n === 'number');
  return xs.length ? Math.round(xs.reduce((p, q) => p + q, 0) / xs.length) : '—';
}

/* ---------- Card (NO TOCADO) ---------- */
function BoletinTable({ r, studentId }: { r: ReportCard; studentId: string }) {
  const courseObj = typeof r.course === 'string' ? null : r.course;
  const courseId = typeof r.course === 'string' ? (r.course as string) : (courseObj?._id as string);
  const courseName = courseObj?.name ?? '';
  const courseYear = courseObj?.year ?? r.year;

  const t1 = r.t1 || {};
  const t2 = r.t2 || {};
  const t3 = r.t3 || {};

  return (
    <section
      className="rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.06)] bg-white print:shadow-none print:border"
      style={{ pageBreakInside: 'avoid' }}
    >
      <div
        className="px-4 py-3 text-white flex items-center justify-between flex-wrap gap-3"
        style={{ background: 'var(--grad-primary)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-xl" style={{ background: 'var(--grad-brand)' }} />
          <div className="truncate">
            <div className="text-xs/4 opacity-90">Instituto Global-T</div>
            <div className="font-heading font-semibold truncate">
              {courseName} {courseYear ? `(${courseYear})` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge c={r.condition} />
          {courseId && (
            <Link to={`/print/final/${courseId}/${studentId}`} className="no-underline">
              <button className="btn btn-secondary !py-1 bg-white/10 hover:bg-white/20 text-white border-white/30">
                Ver / Imprimir
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-xl border border-neutral-200 overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-sm">
            {/* TODA TU TABLA ORIGINAL QUEDA IGUAL */}
            {/* (la omití aquí para no duplicar 200 líneas pero no se cambia nada) */}
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------- Página ---------- */
export default function StudentFinalCards() {

  const [me, setMe] = useState<Me['user'] | null>(null);
  const [rows, setRows] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* NUEVO: año seleccionado */
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    (async () => {
      try {
        const u = await api.me();
        setMe(u.user);
        if (u.user.role === 'student') {
          const r = await api.reportcards.mine();
          setRows(r.cards);
        }
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* MISMA LOGICA + filtro por año */
  const ordered = useMemo(() => {
    return rows
      .filter(r => r.year === selectedYear)
      .slice()
      .sort((a, b) => b.year - a.year);
  }, [rows, selectedYear]);

  if (loading) return <div className="p-4">Cargando…</div>;
  if (me?.role !== 'student') return <div className="p-4 text-danger">Acceso solo para alumnos.</div>;

  return (
    <div className="space-y-3">

      <h1 className="font-heading text-xl">Boletín</h1>

      {/* SELECTOR DE AÑO */}
      <div className="flex items-center gap-3">

        <button
          className="btn btn-secondary"
          onClick={() => setSelectedYear(y => y - 1)}
        >
          ◀
        </button>

        <div className="font-semibold text-lg">
          {selectedYear}
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setSelectedYear(y => y + 1)}
        >
          ▶
        </button>

      </div>

      {err && <div className="text-danger mb-2">{err}</div>}

      {ordered.length === 0 ? (
        <div className="card p-4">
          Aún no hay boletines.
        </div>
      ) : (
        <div className="grid gap-4">
          {ordered.map((c) => (
            <BoletinTable key={c._id} r={c} studentId={me.id} />
          ))}
        </div>
      )}

    </div>
  );
}
