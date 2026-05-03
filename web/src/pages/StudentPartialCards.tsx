import { useEffect, useMemo, useState } from 'react';
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

type Grouped = {
  courseId: string;
  courseName: string;
  year: number;
  may?: Report;
  oct?: Report;
  updatedAt?: string | null;
};

const TERM_LABEL: Record<Term, string> = {
  MAY: 'Mayo',
  OCT: 'Octubre',
};

const gradeChip = (g?: Grade) => {
  if (!g) return 'bg-neutral-200 text-neutral-700';

  switch (g) {
    case 'A':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300';
    case 'B':
      return 'bg-sky-100 text-sky-800 ring-1 ring-sky-300';
    case 'C':
      return 'bg-amber-100 text-amber-800 ring-1 ring-amber-300';
    case 'D':
      return 'bg-orange-100 text-orange-800 ring-1 ring-orange-300';
    case 'E':
      return 'bg-rose-100 text-rose-800 ring-1 ring-rose-300';
  }
};

export default function StudentPartialCards() {
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

        setErr(e?.message || 'No se pudieron cargar los informes parciales.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const grouped: Grouped[] = useMemo(() => {
    const map = new Map<string, Grouped>();

    for (const rep of reports) {
      const c =
        typeof rep.course === 'string'
          ? { _id: rep.course, name: 'Curso', year: rep.year }
          : rep.course;

      const key = String(c._id);

      if (!map.has(key)) {
        map.set(key, {
          courseId: key,
          courseName: c.name,
          year: c.year,
          may: undefined,
          oct: undefined,
          updatedAt: null,
        });
      }

      const g = map.get(key)!;

      if (rep.term === 'MAY') g.may = rep;
      if (rep.term === 'OCT') g.oct = rep;

      const t = rep.updatedAt || rep.createdAt || null;

      if (t && (!g.updatedAt || new Date(t) > new Date(g.updatedAt))) {
        g.updatedAt = t;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.courseName.localeCompare(b.courseName)
    );
  }, [reports]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-fuchsia-500 via-violet-600 to-indigo-600 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-fuchsia-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-indigo-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                📊 Informes del alumno
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Informes parciales
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Consultá tus informes de <b>Mayo</b> y <b>Octubre</b>, con calificaciones en escala <b>A–E</b> y comentarios docentes.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Cursos
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {grouped.length}
                </p>
              </div>

              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-indigo-500">
                  Escala
                </p>
                <p className="mt-1 text-sm font-black text-indigo-800">
                  A–E
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOADING */}
      {loading && (
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-56 animate-pulse rounded-[2rem] bg-neutral-100" />
              <div className="h-56 animate-pulse rounded-[2rem] bg-neutral-100" />
            </div>
          </div>
        </section>
      )}

      {/* ERROR */}
      {!loading && err && (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h2 className="text-xl font-black">
            No se pudieron cargar los informes
          </h2>
          <p className="mt-1 text-sm font-bold">
            {err}
          </p>
        </section>
      )}

      {/* EMPTY */}
      {!loading && !err && grouped.length === 0 && (
        <section className="rounded-[2rem] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <div className="mb-3 text-5xl">
            📭
          </div>

          <h3 className="text-lg font-black text-neutral-800">
            Aún no tenés informes parciales cargados
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Cuando un docente cargue tus informes de Mayo u Octubre, aparecerán en esta sección.
          </p>
        </section>
      )}

      {/* LISTADO */}
      {!loading && !err && grouped.length > 0 && (
        <section className="space-y-5">
          {grouped.map((g) => (
            <CourseBlock key={g.courseId} group={g} />
          ))}
        </section>
      )}
    </div>
  );
}

function CourseBlock({ group }: { group: Grouped }) {
  const updated =
    group.updatedAt
      ? new Date(group.updatedAt).toLocaleDateString()
      : '—';

  return (
    <article className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100">
      <div className="relative overflow-hidden bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-5 py-5 text-white sm:px-6">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm backdrop-blur-sm">
              📘
            </div>

            <div className="min-w-0">
              <h2 className="break-words text-xl font-black leading-tight sm:text-2xl">
                {group.courseName}
              </h2>

              <p className="mt-1 text-sm font-semibold text-white/85">
                Ciclo lectivo {group.year}
              </p>
            </div>
          </div>

          <span className="w-fit rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
            Actualizado: {updated}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <TermCard
          term="MAY"
          report={group.may}
          accent="from-emerald-500 to-emerald-600"
        />

        <TermCard
          term="OCT"
          report={group.oct}
          accent="from-sky-500 to-sky-600"
        />
      </div>
    </article>
  );
}

function TermCard({
  term,
  report,
  accent,
}: {
  term: Term;
  report?: Report;
  accent: string;
}) {
  const g = report?.grades ?? {};

  return (
    <div className="group relative overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-sm transition hover:border-violet-200 hover:shadow-lg">
      <div className={`absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r ${accent}`} />

      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500">
            Período
          </p>

          <h3 className="mt-1 text-xl font-black text-neutral-950">
            {TERM_LABEL[term]}
          </h3>
        </div>

        <div
          className={`shrink-0 rounded-full bg-gradient-to-r ${accent} px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm`}
        >
          {report ? 'Cargado' : 'Sin datos'}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {!report ? (
          <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
            <div className="mb-2 text-4xl">
              📝
            </div>

            <p className="text-sm font-bold text-neutral-700">
              Sin datos para este período
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Cuando el informe esté cargado, vas a verlo acá.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Row label="Reading" value={g.reading} />
              <Row label="Writing" value={g.writing} />
              <Row label="Listening" value={g.listening} />
              <Row label="Speaking" value={g.speaking} />
              <Row label="Attendance" value={g.attendance} />
              <Row label="Commitment" value={g.commitment} />
            </div>

            <div>
              <div className="mb-2 text-sm font-black text-neutral-700">
                Comentarios
              </div>

              <div className="min-h-[86px] rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
                {report.comments?.trim()
                  ? report.comments
                  : <span className="text-neutral-500">Sin comentarios</span>}
              </div>
            </div>

            <Legend />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: Grade }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="text-sm font-bold text-neutral-700">
        {label}
      </span>

      <span className={`rounded-full px-3 py-1 text-xs font-black ${gradeChip(value)}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-gradient-to-r from-neutral-50 to-white p-4 text-xs leading-relaxed text-neutral-700">
      <div className="mb-2 font-black text-neutral-800">
        Escala de calificación
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-center font-bold text-emerald-800">
          A 90–100
        </span>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-center font-bold text-sky-800">
          B 80–89
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-center font-bold text-amber-800">
          C 70–79
        </span>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-center font-bold text-orange-800">
          D 60–69
        </span>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-center font-bold text-rose-800">
          E 0–59
        </span>
      </div>
    </div>
  );
}
}
