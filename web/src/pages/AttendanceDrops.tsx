import { useEffect, useMemo, useState } from 'react';
import { api, type AttendanceFollowUp, type AttendanceFollowUpStatus } from '../lib/api';

const STATUS_OPTIONS: { value: AttendanceFollowUpStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'JUSTIFIED', label: 'Justificado' },
  { value: 'DROP_REQUEST', label: 'Posible baja' },
  { value: 'DROPPED', label: 'Baja' },
  { value: 'RESOLVED', label: 'Resuelto' },
];

const STATUS_LABEL: Record<AttendanceFollowUpStatus, string> = {
  PENDING: 'Pendiente',
  CONTACTED: 'Contactado',
  JUSTIFIED: 'Justificado',
  DROP_REQUEST: 'Posible baja',
  DROPPED: 'Baja',
  RESOLVED: 'Resuelto',
};

function statusClass(status: AttendanceFollowUpStatus) {
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'CONTACTED') return 'bg-sky-100 text-sky-700 border-sky-200';
  if (status === 'JUSTIFIED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'DROP_REQUEST') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (status === 'DROPPED') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-purple-100 text-purple-700 border-purple-200';
}

function fmtDate(s?: string | null) {
  if (!s) return '—';

  const clean = String(s).split('T')[0];
  const parts = clean.split('-');

  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }

  return clean;
}

function teacherName(item: AttendanceFollowUp) {
  const teacher = item.course?.teacher;

  if (!teacher) return 'Sin docente';
  if (typeof teacher === 'string') return 'Docente asignado';

  return teacher.name || teacher.email || 'Sin docente';
}

function courseName(item: AttendanceFollowUp) {
  if (!item.course) return 'Curso no disponible';

  const year = item.course.year ? ` — ${item.course.year}` : '';
  return `${item.course.name}${year}`;
}

function studentName(item: AttendanceFollowUp) {
  return item.student?.name || 'Alumno no disponible';
}

function absenceDatesText(item: AttendanceFollowUp) {
  return item.absenceDates?.length
    ? item.absenceDates.map(fmtDate).join(' · ')
    : fmtDate(item.lastAbsenceDate);
}

type DraftState = Record<
  string,
  {
    status: AttendanceFollowUpStatus;
    reason: string;
    notes: string;
  }
>;

export default function AttendanceDrops() {
  const thisYear = new Date().getFullYear();

  const [year, setYear] = useState<number>(thisYear);
  const [status, setStatus] = useState<AttendanceFollowUpStatus | ''>('');
  const [rows, setRows] = useState<AttendanceFollowUp[]>([]);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detected, setDetected] = useState(0);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      pending: rows.filter(r => r.status === 'PENDING').length,
      drop: rows.filter(r => r.status === 'DROP_REQUEST' || r.status === 'DROPPED').length,
      resolved: rows.filter(r => r.status === 'JUSTIFIED' || r.status === 'RESOLVED').length,
    };
  }, [rows]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await api.attendanceFollowups.list({
        year,
        status: status || undefined,
      });

      setRows(res.rows || []);
      setDetected(res.detected || 0);

      const nextDrafts: DraftState = {};

      for (const item of res.rows || []) {
        nextDrafts[item._id] = {
          status: item.status,
          reason: item.reason || '',
          notes: item.notes || '',
        };
      }

      setDrafts(nextDrafts);
    } catch (e: any) {
      setErr(e?.message || 'No se pudo cargar Asistencia/Bajas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [year, status]);

  function updateDraft(id: string, patch: Partial<DraftState[string]>) {
    setDrafts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  }

  async function save(item: AttendanceFollowUp) {
    const draft = drafts[item._id];

    if (!draft) return;

    setSavingId(item._id);

    try {
      const res = await api.attendanceFollowups.update(item._id, {
        status: draft.status,
        reason: draft.reason,
        notes: draft.notes,
      });

      setRows(prev =>
        prev.map(row => row._id === item._id ? res.item : row)
      );

      setDrafts(prev => ({
        ...prev,
        [item._id]: {
          status: res.item.status,
          reason: res.item.reason || '',
          notes: res.item.notes || '',
        },
      }));
    } catch (e: any) {
      alert(e?.message || 'No se pudo guardar el seguimiento');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 overflow-hidden px-3 py-4 sm:px-4 md:space-y-6 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 p-[2px] shadow-xl">
        <div className="relative rounded-3xl bg-white/95 p-5 sm:p-6 md:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-200/60 blur-3xl" />
          <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-rose-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-700">
                🚨 Seguimiento administrativo
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
                Asistencia / Bajas
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 md:text-base">
                Acá aparecen alumnos que tienen <b>3 ausentes seguidos</b> en un mismo curso.
                Solo cuenta lo cargado como <b>Ausente</b>. Si no hay registro, no se toma como falta.
              </p>
            </div>

            <div className="w-fit rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm shadow-sm">
              <p className="font-black text-orange-800">
                {stats.total} seguimiento{stats.total === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-orange-500">
                Detectados ahora: {detected}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FILTROS */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-2xl">
            🔎
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-black text-neutral-900">
              Filtros
            </h2>
            <p className="text-sm text-neutral-500">
              Filtrá por año y estado del seguimiento.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_240px_auto]">
          <div>
            <label className="mb-1 block text-sm font-bold text-neutral-700">
              Año
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              value={year}
              onChange={e => setYear(Number(e.target.value || thisYear))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-neutral-700">
              Estado
            </label>
            <select
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              value={status}
              onChange={e => setStatus(e.target.value as AttendanceFollowUpStatus | '')}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value || 'ALL'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={load}
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>
      </section>

      {/* RESUMEN */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Total</p>
          <p className="mt-1 text-3xl font-black text-neutral-900">{stats.total}</p>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">Pendientes</p>
          <p className="mt-1 text-3xl font-black text-amber-800">{stats.pending}</p>
        </div>

        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-rose-700">Posibles bajas</p>
          <p className="mt-1 text-3xl font-black text-rose-800">{stats.drop}</p>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Resueltos</p>
          <p className="mt-1 text-3xl font-black text-emerald-800">{stats.resolved}</p>
        </div>
      </section>

      {/* LISTADO */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-neutral-900">
              Alumnos detectados
            </h2>
            <p className="text-sm text-neutral-500">
              Guardá la causa, observaciones y estado del seguimiento.
            </p>
          </div>

          <span className="w-fit rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-700">
            3 ausentes seguidos
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
            <p className="text-sm font-semibold text-neutral-600">Buscando alumnos...</p>
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
            {err}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-10 text-center">
            <div className="mb-3 text-5xl">✅</div>
            <h3 className="text-lg font-black text-neutral-800">
              No hay alumnos con 3 ausentes seguidos
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Cuando se detecten, aparecerán en esta pantalla.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map(item => {
              const draft = drafts[item._id] || {
                status: item.status,
                reason: item.reason || '',
                notes: item.notes || '',
              };

              return (
                <article
                  key={item._id}
                  className="overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-orange-200 hover:shadow-lg sm:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-xl font-black uppercase leading-tight text-neutral-900">
                          {studentName(item)}
                        </h3>

                        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClass(item.status)}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                        <div className="break-words">
                          <span className="font-bold text-neutral-800">Curso:</span>{' '}
                          {courseName(item)}
                        </div>

                        <div className="break-words">
                          <span className="font-bold text-neutral-800">Profesora/docente:</span>{' '}
                          {teacherName(item)}
                        </div>

                        <div className="break-words">
                          <span className="font-bold text-neutral-800">Últimas faltas:</span>{' '}
                          {absenceDatesText(item)}
                        </div>

                        <div>
                          <span className="font-bold text-neutral-800">Racha:</span>{' '}
                          {item.streakCount} ausentes seguidos
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm">
                      <p className="font-black text-rose-700">
                        Atención requerida
                      </p>
                      <p className="text-xs text-rose-500">
                        Revisar causa o posible baja
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[240px_1fr_1fr_auto] lg:items-end">
                    <div>
                      <label className="mb-1 block text-sm font-bold text-neutral-700">
                        Estado
                      </label>
                      <select
                        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        value={draft.status}
                        onChange={e => updateDraft(item._id, { status: e.target.value as AttendanceFollowUpStatus })}
                      >
                        {STATUS_OPTIONS.filter(opt => opt.value).map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-bold text-neutral-700">
                        Causa
                      </label>
                      <input
                        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="Ej: enfermedad, viaje, no responde, posible baja..."
                        value={draft.reason}
                        onChange={e => updateDraft(item._id, { reason: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-bold text-neutral-700">
                        Notas internas
                      </label>
                      <input
                        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        placeholder="Ej: se contactó a la familia..."
                        value={draft.notes}
                        onChange={e => updateDraft(item._id, { notes: e.target.value })}
                      />
                    </div>

                    <button
                      onClick={() => save(item)}
                      disabled={savingId === item._id}
                      className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                    >
                      {savingId === item._id ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
