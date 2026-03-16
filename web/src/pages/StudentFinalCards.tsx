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
  return xs.length
    ? Math.round(xs.reduce((p, q) => p + q, 0) / xs.length)
    : '—';
}

/* ---------- Card (NO TOCADO) ---------- */
function BoletinTable({ r, studentId }: { r: ReportCard; studentId: string }) {
  const courseObj = typeof r.course === 'string' ? null : r.course;
  const courseId =
    typeof r.course === 'string'
      ? (r.course as string)
      : (courseObj?._id as string);

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
      {/* Header */}
      <div
        className="px-4 py-3 text-white flex items-center justify-between flex-wrap gap-3"
        style={{ background: 'var(--grad-primary)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-8 w-8 rounded-xl"
            style={{ background: 'var(--grad-brand)' }}
          />

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
            <Link
              to={`/print/final/${courseId}/${studentId}`}
              className="no-underline"
            >
              <button className="btn btn-secondary !py-1 bg-white/10 hover:bg-white/20 text-white border-white/30">
                Ver / Imprimir
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        <div className="rounded-xl border border-neutral-200 overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-neutral-50 border border-neutral-300 p-2 text-left w-[200px] font-semibold">
                  Área
                </th>

                <th className="bg-neutral-50 border border-neutral-300 p-2 text-center font-semibold">
                  Primer Trimestre
                  <div className="text-xs text-neutral-700">
                    (Marzo/Abril/Mayo)
                  </div>
                </th>

                <th className="bg-neutral-50 border border-neutral-300 p-2 text-center font-semibold">
                  Segundo Trimestre
                  <div className="text-xs text-neutral-700">
                    (Junio/Julio/Agosto)
                  </div>
                </th>

                <th className="bg-neutral-50 border border-neutral-300 p-2 text-center font-semibold">
                  Tercer Trimestre
                  <div className="text-xs text-neutral-700">
                    (Sep/Oct/Nov/Dic)
                  </div>
                </th>

                <th className="bg-neutral-50 border border-neutral-300 p-2 text-center font-semibold w-[100px]">
                  Promedio
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Writing */}
              <tr>
                <td className="border border-neutral-300 p-2 align-top">
                  <b>Writing</b>
                  <div className="text-xs text-neutral-600">(escrito)</div>
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t1.writing)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t2.writing)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t3.writing)}
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {avg3(t1.writing, t2.writing, t3.writing)}
                </td>
              </tr>

              {/* Speaking */}
              <tr>
                <td className="border border-neutral-300 p-2 align-top">
                  <b>Speaking</b>
                  <div className="text-xs text-neutral-600">(oral)</div>
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t1.speaking)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t2.speaking)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t3.speaking)}
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {avg3(t1.speaking, t2.speaking, t3.speaking)}
                </td>
              </tr>

              {/* Reading */}
              <tr>
                <td className="border border-neutral-300 p-2 align-top">
                  <b>Reading</b>
                  <div className="text-xs text-neutral-600">(leer)</div>
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t1.reading)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t2.reading)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t3.reading)}
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {avg3(t1.reading, t2.reading, t3.reading)}
                </td>
              </tr>

              {/* Listening */}
              <tr>
                <td className="border border-neutral-300 p-2 align-top">
                  <b>Listening</b>
                  <div className="text-xs text-neutral-600">(escuchar)</div>
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t1.listening)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t2.listening)}
                </td>
                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {val(t3.listening)}
                </td>

                <td className="border border-neutral-300 p-2 text-center font-semibold">
                  {avg3(t1.listening, t2.listening, t3.listening)}
                </td>
              </tr>

              {/* Firma del alumno */}
              <tr>
                <td className="border border-neutral-300 p-2">
                  <b>Firma del Alumno</b>
                </td>
                <td className="border border-neutral-300 p-2"></td>
                <td className="border border-neutral-300 p-2"></td>
                <td className="border border-neutral-300 p-2"></td>
                <td className="border border-neutral-300 p-2"></td>
              </tr>

              {/* Firma del tutor */}
              <tr>
                <td className="border border-neutral-300 p-2">
                  <b>Firma del Tutor</b>
                </td>
                <td className="border border-neutral-300 p-2"></td>
                <td className="border border-neutral-300 p-2"></td>
                <td className="border border-neutral-300 p-2"></td>
                <td className="border border-neutral-300 p-2"></td>
              </tr>

              {/* Observaciones */}
              <tr>
                <td className="border border-neutral-300 p-2">
                  <b>Observaciones</b>
                </td>
                <td className="border border-neutral-300 p-2">
                  {(t1 as any).comments || '¡Bienvenido! / Welcome!'}
                </td>
                <td className="border border-neutral-300 p-2">
                  {(t2 as any).comments || ''}
                </td>
                <td className="border border-neutral-300 p-2">
                  {(t3 as any).comments || ''}
                </td>
                <td className="border border-neutral-300 p-2"></td>
              </tr>

              {/* Exámenes */}
              <tr>
                <td className="border border-neutral-300 p-2">
                  <b>Exámenes</b>
                </td>

                <td className="border border-neutral-300 p-2"></td>

                <td className="border border-neutral-300 p-2">
                  <div>Oral: <b>{val(r.examOral) as any}</b></div>
                  <div>Escrito: <b>{val(r.examWritten) as any}</b></div>
                </td>

                <td className="border border-neutral-300 p-2">
                  <div>Oral final: <b>{val(r.finalOral) as any}</b></div>
                  <div>Escrito final: <b>{val(r.finalWritten) as any}</b></div>
                </td>

                <td className="border border-neutral-300 p-2"></td>
              </tr>

              {/* Comentarios */}
              {r.comments ? (
                <tr>
                  <td className="border border-neutral-300 p-2">
                    <b>Comentarios</b>
                  </td>
                  <td className="border border-neutral-300 p-2" colSpan={4}>
                    {r.comments}
                  </td>
                </tr>
              ) : null}
            </tbody>
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
  const [year, setYear] = useState<number>(new Date().getFullYear());

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

  const years = useMemo(() => {
    const ys = Array.from(new Set(rows.map(r => r.year)));
    ys.sort((a, b) => b - a);
    return ys;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => r.year === year);
  }, [rows, year]);

  if (loading) return <div className="p-4">Cargando…</div>;
  if (me?.role !== 'student') return <div className="p-4 text-danger">Acceso solo para alumnos.</div>;

  return (
    <div className="space-y-3">

      <h1 className="font-heading text-xl">Boletín</h1>

      {err && <div className="text-danger mb-2">{err}</div>}

      {/* selector de año */}
      <div className="flex items-center gap-4 mb-4">

  <button
    onClick={() => setYear(y => y - 1)}
    className="px-3 py-1 rounded-lg border hover:bg-neutral-100"
  >
    ◀
  </button>

  <div className="text-lg font-semibold">
    {year}
  </div>

  <button
    onClick={() => setYear(y => y + 1)}
    className="px-3 py-1 rounded-lg border hover:bg-neutral-100"
  >
    ▶
  </button>

</div>

      {filtered.length === 0 ? (
        <div className="card p-4">Aún no hay boletines.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((c) => (
            <BoletinTable key={c._id} r={c} studentId={me.id} />
          ))}
        </div>
      )}
    </div>
  );
}
