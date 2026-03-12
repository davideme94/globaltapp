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

/* ---------- Card ---------- */
function BoletinTable({ r, studentId }: { r: ReportCard; studentId: string }) {

  const courseObj = typeof r.course === 'string' ? null : r.course;
  const courseId = typeof r.course === 'string' ? r.course : courseObj?._id;
  const courseName = courseObj?.name ?? '';
  const courseYear = courseObj?.year ?? r.year;

  const t1 = r.t1 || {};
  const t2 = r.t2 || {};
  const t3 = r.t3 || {};

  return (
    <section className="rounded-2xl overflow-hidden shadow bg-white">

      <div
        className="px-4 py-3 text-white flex items-center justify-between"
        style={{ background: 'var(--grad-primary)' }}
      >

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl" style={{ background: 'var(--grad-brand)' }} />
          <div>
            <div className="text-xs opacity-90">Instituto Global-T</div>
            <div className="font-semibold">
              {courseName} ({courseYear})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge c={r.condition} />
          {courseId && (
            <Link to={`/print/final/${courseId}/${studentId}`}>
              <button className="btn btn-secondary !py-1">
                Ver / Imprimir
              </button>
            </Link>
          )}
        </div>

      </div>

      <div className="p-4">

        <table className="w-full border-collapse text-sm">

          <thead>
            <tr>
              <th>Área</th>
              <th>Primer Trimestre</th>
              <th>Segundo Trimestre</th>
              <th>Tercer Trimestre</th>
              <th>Promedio</th>
            </tr>
          </thead>

          <tbody>

            <tr>
              <td>Writing</td>
              <td>{val(t1.writing)}</td>
              <td>{val(t2.writing)}</td>
              <td>{val(t3.writing)}</td>
              <td>{avg3(t1.writing, t2.writing, t3.writing)}</td>
            </tr>

            <tr>
              <td>Speaking</td>
              <td>{val(t1.speaking)}</td>
              <td>{val(t2.speaking)}</td>
              <td>{val(t3.speaking)}</td>
              <td>{avg3(t1.speaking, t2.speaking, t3.speaking)}</td>
            </tr>

            <tr>
              <td>Reading</td>
              <td>{val(t1.reading)}</td>
              <td>{val(t2.reading)}</td>
              <td>{val(t3.reading)}</td>
              <td>{avg3(t1.reading, t2.reading, t3.reading)}</td>
            </tr>

            <tr>
              <td>Listening</td>
              <td>{val(t1.listening)}</td>
              <td>{val(t2.listening)}</td>
              <td>{val(t3.listening)}</td>
              <td>{avg3(t1.listening, t2.listening, t3.listening)}</td>
            </tr>

          </tbody>

        </table>

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

  const currentYear = new Date().getFullYear();

  const ordered = useMemo(() => {

    const sorted = rows.slice().sort((a, b) => b.year - a.year);

    if (sorted.length > 0) return sorted;

    return [{
      _id: 'virtual-' + currentYear,
      year: currentYear,
      course: '',
      condition: 'APPROVED',
      t1: {},
      t2: {},
      t3: {},
      examOral: null,
      examWritten: null,
      finalOral: null,
      finalWritten: null,
      comments: ''
    }] as any;

  }, [rows]);

  if (loading) return <div className="p-4">Cargando…</div>;

  if (me?.role !== 'student')
    return <div className="p-4 text-danger">Acceso solo para alumnos.</div>;

  return (

    <div className="space-y-3">

      <h1 className="font-heading text-xl">Boletín</h1>

      {err && <div className="text-danger mb-2">{err}</div>}

      <div className="grid gap-4">

        {ordered.map((c) => (
          <BoletinTable
            key={c._id}
            r={c}
            studentId={me.id}
          />
        ))}

      </div>

    </div>

  );
}
