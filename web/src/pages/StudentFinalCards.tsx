import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ReportCard, type Me } from '../lib/api';

/* ---------- UI helpers ---------- */
function Badge({ c }: { c: ReportCard['condition'] }) {
  const txt: Record<string, string> = {
    APPROVED: 'Aprobado',
    FAILED_ORAL: 'Desaprobado (oral)',
    FAILED_WRITTEN: 'Desaprobado (escrito)',
    FAILED_BOTH: 'Desaprobado (ambos)',
    PASSED_INTERNAL: 'Pasó con examen interno',
    REPEATER: 'Repitente',
  };

  const cls: Record<string, string> = {
    APPROVED: 'bg-emerald-500 text-white',
    FAILED_ORAL: 'bg-rose-500 text-white',
    FAILED_WRITTEN: 'bg-rose-500 text-white',
    FAILED_BOTH: 'bg-rose-500 text-white',
    PASSED_INTERNAL: 'bg-sky-500 text-white',
    REPEATER: 'bg-amber-500 text-white',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide shadow-sm ${
        cls[c] || 'bg-neutral-500 text-white'
      }`}
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

function GradeValue({ value }: { value: number | string }) {
  const isNumber = typeof value === 'number';

  return (
    <span
      className={`inline-flex min-w-[44px] justify-center rounded-full px-3 py-1 text-sm font-black ${
        isNumber
          ? 'bg-violet-50 text-violet-800 ring-1 ring-violet-200'
          : 'bg-neutral-100 text-neutral-500'
      }`}
    >
      {value}
    </span>
  );
}

/* ---------- Card ---------- */
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
      className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100 print:rounded-none print:border print:shadow-none"
      style={{ pageBreakInside: 'avoid' }}
    >
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 px-5 py-5 text-white sm:px-6">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm backdrop-blur-sm">
              📄
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-white/80">
                Instituto Global-T
              </p>

              <h2 className="mt-1 break-words text-xl font-black leading-tight sm:text-2xl">
                {courseName || 'Curso'} {courseYear ? `(${courseYear})` : ''}
              </h2>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Badge c={r.condition} />

            {courseId && (
              <Link
                to={`/print/final/${courseId}/${studentId}`}
                className="w-full no-underline sm:w-auto"
              >
                <button className="w-full rounded-2xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-white shadow-sm backdrop-blur transition hover:bg-white/25 sm:w-auto">
                  Ver / Imprimir
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-3 text-xs font-semibold text-neutral-500 sm:hidden">
          Deslizá la tabla hacia los costados para ver todos los trimestres.
        </div>

        <div className="overflow-x-auto rounded-3xl border border-neutral-200 bg-white">
          <table className="min-w-[780px] w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-neutral-200 bg-neutral-50 p-3 text-left font-black text-neutral-800">
                  Área
                </th>

                <th className="border border-neutral-200 bg-neutral-50 p-3 text-center font-black text-neutral-800">
                  Primer Trimestre
                  <div className="mt-1 text-xs font-semibold text-neutral-500">
                    Marzo / Abril / Mayo
                  </div>
                </th>

                <th className="border border-neutral-200 bg-neutral-50 p-3 text-center font-black text-neutral-800">
                  Segundo Trimestre
                  <div className="mt-1 text-xs font-semibold text-neutral-500">
                    Junio / Julio / Agosto
                  </div>
                </th>

                <th className="border border-neutral-200 bg-neutral-50 p-3 text-center font-black text-neutral-800">
                  Tercer Trimestre
                  <div className="mt-1 text-xs font-semibold text-neutral-500">
                    Sep / Oct / Nov / Dic
                  </div>
                </th>

                <th className="border border-neutral-200 bg-neutral-50 p-3 text-center font-black text-neutral-800">
                  Promedio
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="border border-neutral-200 p-3 align-top">
                  <b>Writing</b>
                  <div className="text-xs text-neutral-500">(escrito)</div>
                </td>

                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t1.writing)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t2.writing)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t3.writing)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={avg3(t1.writing, t2.writing, t3.writing)} />
                </td>
              </tr>

              <tr>
                <td className="border border-neutral-200 p-3 align-top">
                  <b>Speaking</b>
                  <div className="text-xs text-neutral-500">(oral)</div>
                </td>

                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t1.speaking)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t2.speaking)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t3.speaking)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={avg3(t1.speaking, t2.speaking, t3.speaking)} />
                </td>
              </tr>

              <tr>
                <td className="border border-neutral-200 p-3 align-top">
                  <b>Reading</b>
                  <div className="text-xs text-neutral-500">(leer)</div>
                </td>

                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t1.reading)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t2.reading)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t3.reading)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={avg3(t1.reading, t2.reading, t3.reading)} />
                </td>
              </tr>

              <tr>
                <td className="border border-neutral-200 p-3 align-top">
                  <b>Listening</b>
                  <div className="text-xs text-neutral-500">(escuchar)</div>
                </td>

                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t1.listening)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t2.listening)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={val(t3.listening)} />
                </td>
                <td className="border border-neutral-200 p-3 text-center">
                  <GradeValue value={avg3(t1.listening, t2.listening, t3.listening)} />
                </td>
              </tr>

              <tr>
                <td className="border border-neutral-200 p-3">
                  <b>Firma del Alumno</b>
                </td>
                <td className="border border-neutral-200 p-3"></td>
                <td className="border border-neutral-200 p-3"></td>
                <td className="border border-neutral-200 p-3"></td>
                <td className="border border-neutral-200 p-3"></td>
              </tr>

              <tr>
                <td className="border border-neutral-200 p-3">
                  <b>Firma del Tutor</b>
                </td>
                <td className="border border-neutral-200 p-3"></td>
                <td className="border border-neutral-200 p-3"></td>
                <td className="border border-neutral-200 p-3"></td>
                <td className="border border-neutral-200 p-3"></td>
              </tr>

              <tr>
                <td className="border border-neutral-200 p-3">
                  <b>Observaciones</b>
                </td>
                <td className="border border-neutral-200 p-3">
                  {(t1 as any).comments || '¡Bienvenido! / Welcome!'}
                </td>
                <td className="border border-neutral-200 p-3">
                  {(t2 as any).comments || ''}
                </td>
                <td className="border border-neutral-200 p-3">
                  {(t3 as any).comments || ''}
                </td>
                <td className="border border-neutral-200 p-3"></td>
              </tr>

              <tr>
                <td className="border border-neutral-200 p-3">
                  <b>Exámenes</b>
                </td>

                <td className="border border-neutral-200 p-3"></td>

                <td className="border border-neutral-200 p-3">
                  <div>Oral: <b>{val(r.examOral) as any}</b></div>
                  <div>Escrito: <b>{val(r.examWritten) as any}</b></div>
                </td>

                <td className="border border-neutral-200 p-3">
                  <div>Oral final: <b>{val(r.finalOral) as any}</b></div>
                  <div>Escrito final: <b>{val(r.finalWritten) as any}</b></div>
                </td>

                <td className="border border-neutral-200 p-3"></td>
              </tr>

              {r.comments ? (
                <tr>
                  <td className="border border-neutral-200 p-3">
                    <b>Comentarios</b>
                  </td>
                  <td className="border border-neutral-200 p-3" colSpan={4}>
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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="h-72 animate-pulse rounded-[2rem] bg-neutral-100" />
          </div>
        </section>
      </div>
    );
  }

  if (me?.role !== 'student') {
    return (
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h1 className="text-xl font-black">
            Acceso solo para alumnos
          </h1>
          <p className="mt-1 text-sm font-bold">
            Esta sección está disponible únicamente para perfiles de estudiante.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                🧾 Boletín del estudiante
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Boletín
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Consultá tus calificaciones finales, condición del curso y opción para imprimir el boletín.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Año
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {year}
                </p>
              </div>

              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-sky-500">
                  Boletines
                </p>
                <p className="mt-1 text-sm font-black text-sky-800">
                  {filtered.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h2 className="text-xl font-black">
            No se pudo cargar el boletín
          </h2>
          <p className="mt-1 text-sm font-bold">
            {err}
          </p>
        </section>
      )}

      {/* SELECTOR DE AÑO */}
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-neutral-950">
              Seleccionar año
            </h2>
            <p className="text-sm text-neutral-500">
              Cambiá el ciclo lectivo para consultar otros boletines.
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-3 rounded-3xl border border-neutral-200 bg-neutral-50 p-2 sm:w-auto">
            <button
              onClick={() => setYear(y => y - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-lg font-black text-neutral-700 shadow-sm transition hover:bg-neutral-100"
            >
              ◀
            </button>

            <div className="min-w-[96px] text-center text-2xl font-black text-neutral-950">
              {year}
            </div>

            <button
              onClick={() => setYear(y => y + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-lg font-black text-neutral-700 shadow-sm transition hover:bg-neutral-100"
            >
              ▶
            </button>
          </div>
        </div>

        {years.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
                  y === year
                    ? 'border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-100'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </section>

      {filtered.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <div className="mb-3 text-5xl">
            📭
          </div>

          <h3 className="text-lg font-black text-neutral-800">
            Aún no hay boletines para {year}
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Cuando el boletín esté cargado, aparecerá en esta sección.
          </p>
        </section>
      ) : (
        <section className="grid gap-5">
          {filtered.map((c) => (
            <BoletinTable key={c._id} r={c} studentId={me.id} />
          ))}
        </section>
      )}
    </div>
  );
}
