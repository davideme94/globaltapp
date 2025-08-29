import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Term = 'MAY' | 'OCT';
type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

type Report = {
  _id: string;
  course: { _id: string; name: string; year: number } | string;
  student: string | { _id: string; name: string };
  teacher?: string | { _id: string; name: string };
  year: number;
  term: Term;
  grades: {
    reading: Grade;
    writing: Grade;
    listening: Grade;
    speaking: Grade;
    attendance: Grade;
    commitment: Grade;
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

const TERM_LABEL: Record<Term, string> = { MAY: 'Mayo', OCT: 'Octubre' };

/** ——— helpers visuales ——— */
const gradeChip = (g?: Grade) => {
  if (!g) return 'bg-neutral-200 text-neutral-700';
  switch (g) {
    case 'A': return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300';
    case 'B': return 'bg-sky-100 text-sky-800 ring-1 ring-sky-300';
    case 'C': return 'bg-amber-100 text-amber-800 ring-1 ring-amber-300';
    case 'D': return 'bg-orange-100 text-orange-800 ring-1 ring-orange-300';
    case 'E': return 'bg-rose-100 text-rose-800 ring-1 ring-rose-300';
  }
};

export default function StudentPartialCards() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
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
    return () => { alive = false; };
  }, []);

  const grouped: Grouped[] = useMemo(() => {
    const map = new Map<string, Grouped>();
    for (const rep of reports) {
      const c = typeof rep.course === 'string'
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
    return Array.from(map.values()).sort((a, b) => a.courseName.localeCompare(b.courseName));
  }, [reports]);

  return (
    <div className="space-y-4">
      {/* Header general */}
      <div className="rounded-2xl p-[1px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500">
        <div className="rounded-2xl bg-white p-4">
          <h1 className="font-heading text-xl">Informes parciales</h1>
          <p className="text-neutral-700">Mayo y Octubre, escala A–E.</p>
        </div>
      </div>

      {loading && (
        <div className="card p-4 space-y-2">
          <div className="h-5 w-56 skeleton" />
          <div className="h-24 skeleton" />
        </div>
      )}

      {!loading && err && (
        <div className="card p-4 text-danger">{err}</div>
      )}

      {!loading && !err && grouped.length === 0 && (
        <div className="card p-4">Aún no tenés informes parciales cargados.</div>
      )}

      {!loading && !err && grouped.map((g) => (
        <CourseBlock key={g.courseId} group={g} />
      ))}
    </div>
  );
}

function CourseBlock({ group }: { group: Grouped }) {
  const updated = group.updatedAt ? new Date(group.updatedAt).toLocaleDateString() : '—';

  return (
    <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-neutral-200">
      {/* Tira superior tipo boletín */}
      <div className="bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-white/20 backdrop-blur-sm" />
          <div className="font-heading">
            {group.courseName} <span className="opacity-90">({group.year})</span>
          </div>
        </div>
        <span className="text-xs rounded-full bg-white/15 px-3 py-1">
          Actualizado: {updated}
        </span>
      </div>

      {/* Tarjetas por término */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <TermCard term="MAY" report={group.may} accent="from-emerald-500 to-emerald-600" />
        <TermCard term="OCT" report={group.oct} accent="from-sky-500 to-sky-600" />
      </div>
    </div>
  );
}

function TermCard({
  term, report, accent,
}: { term: Term; report?: Report; accent: string }) {
  return (
    <div className="group relative rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      {/* badge del término – no intercepta clics y queda por encima */}
      <div
        className={`pointer-events-none absolute right-3 top-2 md:top-3 z-10
                    text-xs font-medium text-white rounded-full px-3 py-1
                    bg-gradient-to-r ${accent} shadow-sm`}
      >
        {TERM_LABEL[term]}
      </div>

      {/* padding-top extra para que el badge no tape la primera fila */}
      <div className="p-4 pt-10 md:pt-12 space-y-3">
        {!report ? (
          <div className="text-neutral-700">Sin datos</div>
        ) : (
          <>
            {/* grilla de notas */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Row label="Reading" value={report.grades.reading} />
              <Row label="Writing" value={report.grades.writing} />
              <Row label="Listening" value={report.grades.listening} />
              <Row label="Speaking" value={report.grades.speaking} />
              <Row label="Attendance" value={report.grades.attendance} />
              <Row label="Commitment" value={report.grades.commitment} />
            </div>

            {/* comentarios */}
            <div className="text-sm">
              <div className="font-medium mb-1">Comentarios</div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 min-h-[56px]">
                {report.comments?.trim()
                  ? report.comments
                  : <span className="text-neutral-600">Sin comentarios</span>}
              </div>
            </div>

            {/* leyenda */}
            <Legend />
          </>
        )}
      </div>

      {/* borde inferior con acento */}
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: Grade }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <span className="text-neutral-700">{label}</span>
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${gradeChip(value)}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="rounded-xl bg-gradient-to-r from-neutral-50 to-white border border-neutral-200 p-2 text-[11px] text-neutral-700">
      <span className="font-medium mr-2">Escala:</span>
      <span className="mr-3">A 90–100</span>
      <span className="mr-3">B 80–89</span>
      <span className="mr-3">C 70–79</span>
      <span className="mr-3">D 60–69</span>
      <span>E 0–59</span>
    </div>
  );
}
