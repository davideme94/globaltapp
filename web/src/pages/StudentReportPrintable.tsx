import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Term = 'MAY' | 'OCT';
type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

type Report = {
  _id: string | null;
  course: { _id: string; name: string; year: number; campus?: string } | string;
  student: string | { _id: string; name: string; email?: string };
  teacher?: string | { _id: string; name: string; email?: string };
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
  if (!g) return 'border-neutral-200 bg-neutral-100 text-neutral-500';

  switch (g) {
    case 'A':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'B':
      return 'border-sky-200 bg-sky-100 text-sky-800';
    case 'C':
      return 'border-amber-200 bg-amber-100 text-amber-800';
    case 'D':
      return 'border-orange-200 bg-orange-100 text-orange-800';
    case 'E':
      return 'border-rose-200 bg-rose-100 text-rose-800';
  }
};

const gradeAccent = (g?: Grade) => {
  if (!g) return 'from-neutral-200 to-neutral-100';

  switch (g) {
    case 'A':
      return 'from-emerald-400 to-green-500';
    case 'B':
      return 'from-sky-400 to-blue-500';
    case 'C':
      return 'from-amber-300 to-yellow-500';
    case 'D':
      return 'from-orange-300 to-orange-500';
    case 'E':
      return 'from-rose-300 to-pink-500';
  }
};

const getName = (
  value: string | { _id?: string; name?: string; email?: string } | undefined,
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

async function getPrintableReport(reportId: string): Promise<Report> {
  const apiAny = api as any;

  if (apiAny?.partials?.print) {
    const data = await apiAny.partials.print(reportId);
    return (data.report ?? data.row ?? data) as Report;
  }

  if (apiAny?.get) {
    const data = await apiAny.get(`/partials/${reportId}/print`);
    return (data.report ?? data.row ?? data) as Report;
  }

  const base = import.meta.env.VITE_API_URL || '/api';

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('accessToken') ||
    '';

  const res = await fetch(`${base}/partials/${reportId}/print`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || data?.message || 'No se pudo cargar el informe.');
  }

  return (data.report ?? data.row ?? data) as Report;
}

export default function StudentReportPrintable() {
  const { reportId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!reportId) {
        setLoading(false);
        setErr('No se encontró el ID del informe.');
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const printableReport = await getPrintableReport(reportId);

        if (!alive) return;

        setReport(printableReport);
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
  }, [reportId]);

  const grades = report?.grades ?? {};
  const courseName = getCourseName(report);
  const courseYear = getCourseYear(report);
  const studentName = getName(report?.student, 'Alumno/a');
  const teacherName = getName(report?.teacher, 'Docente');

  const canUseActions = Boolean(report && !loading && !err);

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="print-page min-h-screen bg-[radial-gradient(circle_at_top_left,#f5d0fe_0,#eef2ff_35%,#ffffff_75%)] px-3 py-4 text-neutral-950 sm:px-6 md:py-8">
      <style>
        {`
          @media screen and (max-width: 767px) {
            .mobile-action-card {
              border-radius: 28px !important;
            }

            .desktop-actions {
              display: none !important;
            }

            .screen-print-card {
              border-radius: 28px !important;
            }

            .screen-header {
              min-height: auto !important;
            }

            .screen-header-inner {
              flex-direction: column !important;
              align-items: flex-start !important;
            }

            .screen-period {
              align-self: stretch !important;
              width: 100% !important;
            }

            .screen-body-grid {
              display: grid !important;
              grid-template-columns: 1fr !important;
              height: auto !important;
            }

            .screen-left,
            .screen-right {
              grid-column: auto !important;
              width: 100% !important;
            }

            .screen-grades-grid {
              grid-template-columns: 1fr !important;
            }

            .screen-scale-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .screen-comment-box {
              height: auto !important;
              max-height: none !important;
            }

            .screen-comment-inner {
              height: auto !important;
              max-height: none !important;
            }

            .comment-text {
              display: block !important;
              overflow: visible !important;
            }
          }

          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }

            html,
            body,
            #root {
              width: 297mm !important;
              height: 210mm !important;
              min-width: 297mm !important;
              min-height: 210mm !important;
              max-width: 297mm !important;
              max-height: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: white !important;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }

            body * {
              visibility: hidden !important;
            }

            #print-area,
            #print-area * {
              visibility: visible !important;
            }

            .print-page {
              width: 297mm !important;
              height: 210mm !important;
              min-height: 0 !important;
              max-height: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: white !important;
            }

            .print-wrapper {
              width: 297mm !important;
              height: 210mm !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 5mm !important;
              overflow: hidden !important;
            }

            #print-area {
              position: fixed !important;
              left: 5mm !important;
              top: 5mm !important;
              width: 287mm !important;
              height: 200mm !important;
              min-height: 200mm !important;
              max-height: 200mm !important;
              overflow: hidden !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
              page-break-inside: avoid !important;
              break-after: avoid !important;
              break-before: avoid !important;
              break-inside: avoid !important;
              border-radius: 18px !important;
              box-shadow: none !important;
            }

            .no-print {
              display: none !important;
              visibility: hidden !important;
              height: 0 !important;
              max-height: 0 !important;
              overflow: hidden !important;
            }

            .screen-header {
              height: 38mm !important;
              min-height: 38mm !important;
              max-height: 38mm !important;
            }

            .screen-body-grid {
              display: grid !important;
              grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
              height: 162mm !important;
              max-height: 162mm !important;
              overflow: hidden !important;
            }

            .screen-left {
              grid-column: span 5 / span 5 !important;
              overflow: hidden !important;
            }

            .screen-right {
              grid-column: span 7 / span 7 !important;
              overflow: hidden !important;
            }

            .screen-grades-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .screen-scale-grid {
              grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            }

            .screen-comment-box {
              height: 78mm !important;
              max-height: 78mm !important;
              overflow: hidden !important;
            }

            .screen-comment-inner {
              height: 63mm !important;
              max-height: 63mm !important;
              overflow: hidden !important;
            }

            .comment-text {
              display: block !important;
              overflow: hidden !important;
              text-overflow: clip !important;
            }

            .print-break-inside {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }

          @media screen and (min-width: 768px) {
            .comment-text {
              display: block;
              overflow: visible;
              text-overflow: clip;
            }
          }
        `}
      </style>

      <div className="print-wrapper mx-auto w-full max-w-6xl space-y-5">
        {/* ACCIONES */}
        <div className="no-print mobile-action-card flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-xl shadow-violet-100/60 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-violet-600">
              Vista completa del informe
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950 md:text-3xl">
              Informe parcial
            </h1>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-neutral-500 md:text-base">
              Visualización completa del informe parcial del alumno/a.
            </p>
          </div>

          <div className="desktop-actions grid gap-2 md:min-w-[360px] md:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-50 active:scale-[0.98]"
            >
              ← Volver
            </button>

            <button
              type="button"
              disabled={!canUseActions}
              onClick={handlePrint}
              className={
                canUseActions
                  ? 'rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]'
                  : 'cursor-not-allowed rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-400'
              }
            >
              📄 Imprimir PDF
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

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 rounded-2xl bg-rose-600 px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-rose-700"
            >
              Volver
            </button>
          </section>
        )}

        {/* NO ENCONTRADO */}
        {!loading && !err && !report && (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
            <h2 className="text-xl font-black">
              Informe no encontrado
            </h2>

            <p className="mt-1 text-sm font-bold">
              No se encontró un informe cargado para esta dirección.
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
            className="screen-print-card overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-2xl shadow-violet-100"
          >
            {/* ENCABEZADO */}
            <section className="screen-header relative overflow-hidden bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600 px-5 py-5 text-white md:px-6">
              <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-cyan-200/20 blur-3xl" />
              <div className="absolute left-1/2 top-8 h-24 w-24 rounded-full bg-pink-300/20 blur-2xl" />

              <div className="screen-header-inner relative flex h-full items-center justify-between gap-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-lg shadow-violet-900/20">
                    📘
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-white/75">
                      Instituto Global-T
                    </p>

                    <h2 className="mt-1 break-words text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
                      {courseName}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-white/90">
                      Informe parcial de desempeño · Ciclo lectivo {courseYear}
                    </p>
                  </div>
                </div>

                <div className="screen-period shrink-0 rounded-[1.5rem] border border-white/30 bg-white px-6 py-4 text-center text-neutral-950 shadow-xl shadow-violet-900/20">
                  <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                    Período
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {TERM_LABEL[report.term]}
                  </p>
                </div>
              </div>
            </section>

            {/* CUERPO */}
            <section className="screen-body-grid grid grid-cols-1 gap-4 overflow-hidden bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-4 py-4 md:grid-cols-12 md:gap-3 md:px-5 md:py-3">
              {/* IZQUIERDA */}
              <div className="screen-left space-y-3 overflow-hidden md:col-span-5">
                <div className="grid gap-2">
                  <InfoBox
                    icon="👩‍🎓"
                    label="Alumno/a"
                    value={studentName}
                  />

                  <InfoBox
                    icon="👨‍🏫"
                    label="Docente"
                    value={teacherName}
                  />
                </div>

                <div className="screen-comment-box overflow-hidden rounded-[1.5rem] border border-violet-100 bg-white shadow-sm">
                  <div className="bg-gradient-to-r from-fuchsia-500 via-violet-600 to-indigo-600 px-4 py-3 text-white md:py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/75 md:text-[9px]">
                      Observaciones docentes
                    </p>

                    <h3 className="mt-0.5 text-xl font-black md:text-lg">
                      Comentarios
                    </h3>
                  </div>

                  <div className="bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-3">
                    <div className="screen-comment-inner overflow-hidden whitespace-pre-wrap rounded-[1.25rem] border border-violet-100 bg-white p-4 text-sm leading-relaxed text-neutral-800 shadow-sm md:p-3 md:text-[9.5px] md:leading-[1.28]">
                      <div className="comment-text">
                        {report.comments?.trim()
                          ? report.comments
                          : <span className="text-neutral-500">Sin comentarios.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DERECHA */}
              <div className="screen-right space-y-3 overflow-hidden md:col-span-7">
                <div>
                  <div className="mb-3 flex flex-col gap-3 md:mb-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-600 md:text-[9px]">
                        Desempeño académico
                      </p>

                      <h3 className="mt-0.5 text-2xl font-black text-neutral-950 md:text-xl">
                        Calificaciones del período
                      </h3>

                      <p className="mt-0.5 text-xs font-semibold text-neutral-500 md:text-[11px]">
                        Escala institucional de valoración A–E.
                      </p>
                    </div>

                    <div className="w-fit rounded-2xl bg-gradient-to-r from-violet-100 to-indigo-100 px-4 py-2 text-left md:text-right">
                      <p className="text-[10px] font-black uppercase tracking-wide text-violet-600 md:text-[9px]">
                        Global-T
                      </p>
                      <p className="text-xs font-black text-neutral-900 md:text-[11px]">
                        Progress Report
                      </p>
                    </div>
                  </div>

                  <div className="screen-grades-grid grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-2.5">
                    <GradeCard label="Reading" value={grades.reading} />
                    <GradeCard label="Writing" value={grades.writing} />
                    <GradeCard label="Listening" value={grades.listening} />
                    <GradeCard label="Speaking" value={grades.speaking} />
                    <GradeCard label="Attendance" value={grades.attendance} />
                    <GradeCard label="Commitment" value={grades.commitment} />
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-violet-100 bg-white p-4 shadow-sm md:p-3">
                  <div className="mb-3 md:mb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-600 md:text-[9px]">
                      Referencia
                    </p>

                    <h3 className="mt-0.5 text-xl font-black text-neutral-950 md:text-lg">
                      Escala de calificación
                    </h3>
                  </div>

                  <div className="screen-scale-grid grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                    <ScaleItem grade="A" text="90–100" />
                    <ScaleItem grade="B" text="80–89" />
                    <ScaleItem grade="C" text="70–79" />
                    <ScaleItem grade="D" text="60–69" />
                    <ScaleItem grade="E" text="0–59" />
                  </div>
                </div>
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-violet-100 bg-white p-4 shadow-sm md:h-[22mm] md:p-3">
      <div className="absolute right-4 top-4 text-3xl opacity-20">
        {icon}
      </div>

      <p className="text-[10px] font-black uppercase tracking-wide text-violet-500 md:text-[9px]">
        {label}
      </p>

      <p className="mt-1.5 break-words text-base font-black text-neutral-950 md:mt-1 md:text-sm">
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
    <div className="print-break-inside overflow-hidden rounded-[1.25rem] border border-neutral-200 bg-white shadow-sm md:h-[24mm]">
      <div className={`h-1.5 bg-gradient-to-r ${gradeAccent(value)}`} />

      <div className="flex items-center justify-between gap-3 p-3 md:p-2.5">
        <div>
          <p className="text-sm font-black text-neutral-950">
            {label}
          </p>

          <p className="mt-0.5 text-[10px] font-bold text-neutral-500">
            {value ? `${GRADE_LABEL[value]} · ${GRADE_RANGE[value]}` : 'Sin calificación'}
          </p>
        </div>

        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-base font-black md:h-10 md:w-10 ${gradeChip(value)}`}>
          {value ?? '—'}
        </span>
      </div>
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
    <div className={`overflow-hidden rounded-2xl border bg-white text-center shadow-sm md:h-[19mm] ${gradeChip(grade)}`}>
      <div className={`h-1.5 bg-gradient-to-r ${gradeAccent(grade)}`} />

      <div className="px-2 py-2 md:py-1.5">
        <p className="text-base font-black">
          {grade}
        </p>

        <p className="mt-0.5 text-[10px] font-bold md:text-[9px]">
          {text}
        </p>
      </div>
    </div>
  );
}
