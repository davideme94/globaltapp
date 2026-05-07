import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Term = 'MAY' | 'OCT';
type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

type Report = {
  _id: string | null;
  course: { _id: string; name: string; year: number } | string;
  student: string | { _id: string; name: string };
  teacher?: string | { _id: string; name: string };
  year: number;
  term: Term;
  grades?: {
    reading?: Grade;
    writing?: Grade;
    listening?: Grade;
    speaking?: Grade;
    attendance?: Grade;
    commitment?: Grade;
  };
  comments?: string;
  updatedAt?: string;
  createdAt?: string;
};

const TERM_LABEL: Record<Term, string> = {
  MAY: 'Mayo',
  OCT: 'Octubre',
};

const GRADE_LABEL: Record<Grade, string> = {
  A: 'Excelente',
  B: 'Muy bueno',
  C: 'Bueno',
  D: 'En proceso',
  E: 'Necesita fortalecer',
};

const GRADE_RANGE: Record<Grade, string> = {
  A: '90–100',
  B: '80–89',
  C: '70–79',
  D: '60–69',
  E: '0–59',
};

const gradeChip = (g?: Grade) => {
  if (!g) return 'bg-neutral-100 text-neutral-500 border-neutral-200';

  switch (g) {
    case 'A':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'B':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'C':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'D':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'E':
      return 'bg-rose-50 text-rose-800 border-rose-200';
  }
};

const getName = (
  value: string | { _id?: string; name?: string } | undefined,
  fallback: string
) => {
  if (!value) return fallback;
  if (typeof value === 'string') return fallback;
  return value.name || fallback;
};

const getCourseName = (report: Report | null) => {
  if (!report) return 'Curso';
  if (typeof report.course === 'string') return 'Curso';
  return report.course.name || 'Curso';
};

const getCourseYear = (report: Report | null) => {
  if (!report) return '—';
  if (typeof report.course === 'string') return report.year;
  return report.course.year || report.year || '—';
};

const formatDate = (date?: string) => {
  if (!date) return '—';

  try {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

export default function StudentReportPrintable() {
  const { reportId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const r = await api.partials.mine() as any;
        const list: Report[] = (r.reports ?? r.rows ?? []) as Report[];

        if (!alive) return;

        setReports(list);
      } catch (e: any) {
        if (!alive) return;

        setErr(e?.message || 'No se pudo cargar el informe.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const report = useMemo(() => {
    return reports.find((item) => item._id === reportId) ?? null;
  }, [reports, reportId]);

  const grades = report?.grades ?? {};
  const courseName = getCourseName(report);
  const courseYear = getCourseYear(report);
  const studentName = getName(report?.student, 'Alumno/a');
  const teacherName = getName(report?.teacher, 'Docente');
  const updated = formatDate(report?.updatedAt || report?.createdAt);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f5d0fe_0,#eef2ff_35%,#ffffff_70%)] px-3 py-4 text-neutral-950 sm:px-6 md:py-8">
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 14mm;
            }

            html,
            body {
              background: white !important;
            }

            body * {
              visibility: hidden;
            }

            #print-area,
            #print-area * {
              visibility: visible;
            }

            #print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }

            .no-print {
              display: none !important;
            }

            .print-card {
              box-shadow: none !important;
              border: 1px solid #e5e7eb !important;
              border-radius: 24px !important;
            }

            .print-bg {
              background: white !important;
            }

            .print-break-inside {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}
      </style>

      <div className="mx-auto w-full max-w-4xl space-y-5">
        {/* ACCIONES */}
        <div className="no-print flex flex-col gap-3 rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-xl shadow-violet-100/60 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-600">
              Vista imprimible
            </p>

            <h1 className="mt-1 text-xl font-black tracking-tight text-neutral-950 sm:text-2xl">
              Informe parcial para PDF
            </h1>

            <p className="mt-1 text-sm font-semibold text-neutral-500">
              Desde acá podés guardar o compartir el informe como PDF.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-50 active:scale-[0.98]"
            >
              ← Volver
            </button>

            <button
              type="button"
              disabled={!report || loading || Boolean(err)}
              onClick={() => window.print()}
              className={
                report && !loading && !err
                  ? 'rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]'
                  : 'cursor-not-allowed rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-400'
              }
            >
              📄 Guardar / Imprimir PDF
            </button>
          </div>
        </div>

        {/* LOADING */}
        {loading && (
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-neutral-100 backdrop-blur">
            <div className="space-y-5">
              <div className="h-8 w-64 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-4 w-full animate-pulse rounded-full bg-neutral-100" />
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-neutral-100" />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
                <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
                <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
                <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
              </div>
            </div>
          </section>
        )}

        {/* ERROR */}
        {!loading && err && (
          <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
            <h2 className="text-xl font-black">
              No se pudo cargar el informe
            </h2>

            <p className="mt-1 text-sm font-bold">
              {err}
            </p>
          </section>
        )}

        {/* NO ENCONTRADO */}
        {!loading && !err && !report && (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
            <h2 className="text-xl font-black">
              Informe no encontrado
            </h2>

            <p className="mt-1 text-sm font-bold">
              No se encontró un informe cargado para esta dirección. Volvé a la pantalla de informes e intentá nuevamente.
            </p>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 rounded-2xl bg-amber-600 px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-amber-700"
            >
              Volver
            </button>
          </section>
        )}

        {/* INFORME */}
        {!loading && !err && report && (
          <main
            id="print-area"
            className="print-bg print-card overflow-hidden rounded-[2.25rem] border border-white/80 bg-white shadow-2xl shadow-violet-100"
          >
            {/* ENCABEZADO */}
            <section className="relative overflow-hidden bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-7 text-white sm:px-8 sm:py-9">
              <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-sm backdrop-blur">
                    📘
                  </div>

                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">
                    Informe parcial
                  </p>

                  <h2 className="mt-2 break-words text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                    {courseName}
                  </h2>

                  <p className="mt-2 text-sm font-semibold text-white/85">
                    Ciclo lectivo {courseYear}
                  </p>
                </div>

                <div className="w-fit rounded-3xl border border-white/20 bg-white/15 px-5 py-4 text-left shadow-sm backdrop-blur sm:text-right">
                  <p className="text-xs font-black uppercase tracking-wide text-white/70">
                    Período
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {TERM_LABEL[report.term]}
                  </p>
                </div>
              </div>
            </section>

            {/* DATOS PRINCIPALES */}
            <section className="grid gap-4 border-b border-neutral-100 bg-neutral-50 px-5 py-5 sm:grid-cols-3 sm:px-8">
              <InfoBox
                label="Alumno/a"
                value={studentName}
              />

              <InfoBox
                label="Docente"
                value={teacherName}
              />

              <InfoBox
                label="Actualizado"
                value={updated}
              />
            </section>

            {/* CALIFICACIONES */}
            <section className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                  Desempeño académico
                </p>

                <h3 className="mt-1 text-2xl font-black text-neutral-950">
                  Calificaciones del período
                </h3>

                <p className="mt-1 text-sm font-semibold text-neutral-500">
                  Escala institucional de valoración A–E.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <GradeCard label="Reading" value={grades.reading} />
                <GradeCard label="Writing" value={grades.writing} />
                <GradeCard label="Listening" value={grades.listening} />
                <GradeCard label="Speaking" value={grades.speaking} />
                <GradeCard label="Attendance" value={grades.attendance} />
                <GradeCard label="Commitment" value={grades.commitment} />
              </div>
            </section>

            {/* COMENTARIOS */}
            <section className="print-break-inside px-5 pb-6 sm:px-8 sm:pb-8">
              <div className="rounded-[2rem] border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                  Observaciones docentes
                </p>

                <h3 className="mt-1 text-xl font-black text-neutral-950">
                  Comentarios
                </h3>

                <div className="mt-4 min-h-[120px] whitespace-pre-wrap rounded-3xl border border-neutral-200 bg-white p-5 text-sm leading-relaxed text-neutral-700">
                  {report.comments?.trim()
                    ? report.comments
                    : <span className="text-neutral-500">Sin comentarios.</span>}
                </div>
              </div>
            </section>

            {/* ESCALA */}
            <section className="print-break-inside border-t border-neutral-100 bg-neutral-50 px-5 py-6 sm:px-8">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                  Referencia
                </p>

                <h3 className="mt-1 text-xl font-black text-neutral-950">
                  Escala de calificación
                </h3>
              </div>

              <div className="grid gap-2 sm:grid-cols-5">
                <ScaleItem grade="A" text="90–100" />
                <ScaleItem grade="B" text="80–89" />
                <ScaleItem grade="C" text="70–79" />
                <ScaleItem grade="D" text="60–69" />
                <ScaleItem grade="E" text="0–59" />
              </div>
            </section>

            {/* PIE */}
            <footer className="border-t border-neutral-100 px-5 py-5 text-center sm:px-8">
              <p className="text-xs font-semibold leading-relaxed text-neutral-500">
                Este documento corresponde a la vista imprimible del informe parcial del alumno/a.
              </p>
            </footer>
          </main>
        )}
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function GradeCard({
  label,
  value,
}: {
  label: string;
  value?: Grade;
}) {
  return (
    <div className="print-break-inside flex items-center justify-between gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-black text-neutral-900">
          {label}
        </p>

        <p className="mt-1 text-xs font-semibold text-neutral-500">
          {value ? `${GRADE_LABEL[value]} · ${GRADE_RANGE[value]}` : 'Sin calificación'}
        </p>
      </div>

      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg font-black ${gradeChip(value)}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function ScaleItem({
  grade,
  text,
}: {
  grade: Grade;
  text: string;
}) {
  return (
    <div className={`rounded-2xl border px-3 py-3 text-center ${gradeChip(grade)}`}>
      <p className="text-lg font-black">
        {grade}
      </p>

      <p className="mt-0.5 text-xs font-bold">
        {text}
      </p>
    </div>
  );
}
