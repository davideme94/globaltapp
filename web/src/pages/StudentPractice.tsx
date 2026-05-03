import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { normalizeEmbedUrl } from '../lib/media';
import '../styles/student-practice.css';

type Q = {
  _id: string;
  prompt: string;
  type: 'MC' | 'GAP';
  options?: string[] | null;
  imageUrl?: string | null;
  embedUrl?: string | null;
  unit?: number | null;
};

type Progress = {
  total: number;
  seen: number;
  remaining: number;
};

export default function StudentPractice() {
  // --- NUEVO: modo tester (coord/admin) si vienen ?as= & set=
  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();

  const testerAs = params.get('as') || '';
  const testerSet = params.get('set') || '';
  const testerUnit = params.get('unit') ? Number(params.get('unit')) : undefined;

  // --- NUEVO: sets habilitados (si el backend los expone)
  const [mySets, setMySets] = useState<{ set: { _id: string; title: string; units?: number }, updatedAt: string }[]>([]);
  const [setId, setSetId] = useState<string>(testerSet || '');
  const [unit, setUnit] = useState<number | ''>(typeof testerUnit === 'number' ? testerUnit : '');
  const [mode, setMode] = useState<'sets' | 'legacy'>(testerSet ? 'sets' : 'legacy');

  // --- juego
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const q = qs[idx];

  // monta: intenta modo tester → sets → legacy
  useEffect(() => {
    (async () => {
      try {
        // 1) tester directo
        if (testerAs && testerSet) {
          setMode('sets');
          setSetId(testerSet);
          await loadBatch(testerSet, typeof testerUnit === 'number' ? testerUnit : undefined, testerAs);
          return;
        }

        // 2) sets habilitados
        const r = await api.practice.mySets().catch(() => ({ rows: [] as any[] }));
        const rows = r?.rows || [];

        if (rows.length > 0) {
          setMySets(rows);
          setSetId(rows[0].set._id);
          setMode('sets');
          setLoading(false);
          return;
        }

        // 3) legacy
        const legacy = await api.practice.play();

        setQs(legacy.questions);
        setIdx(0);
        setScore({ ok: 0, total: 0 });
        setMode('legacy');
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // carga un batch del set (no repite + trae progreso)
  async function loadBatch(currentSetId: string, currentUnit?: number, asStudentId?: string) {
    setLoading(true);
    setErr(null);

    try {
      const r = asStudentId
        ? await api.practice.playAs(asStudentId, currentSetId, currentUnit)
        : await api.practice.playSet(currentSetId, currentUnit);

      setQs(r.questions || []);
      setIdx(0);
      setAnswer('');
      setProgress(r.progress || null);
      setCompleted(!!r.completed);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startWithSet() {
    if (!setId) return;

    setScore({ ok: 0, total: 0 });
    setCompleted(false);

    await loadBatch(setId, unit ? Number(unit) : undefined, testerAs || undefined);
  }

  async function submit(a: string) {
    if (!q) return;

    const res = testerAs
      ? await api.practice.submitAs(testerAs, q._id, a)
      : await api.practice.submit(q._id, a);

    setScore(s => ({
      ok: s.ok + (res.correct ? 1 : 0),
      total: s.total + 1,
    }));

    setAnswer('');

    // próxima pregunta del batch
    if (idx + 1 < qs.length) {
      setIdx(idx + 1);
      return;
    }

    // fin del batch → pedimos más (o felicidades si no hay)
    if (mode === 'sets' && setId) {
      await loadBatch(setId, unit ? Number(unit) : undefined, testerAs || undefined);
    } else {
      // legacy simplemente vuelve a pedir
      const legacy = await api.practice.play();

      setQs(legacy.questions);
      setIdx(0);
    }
  }

  const pct = useMemo(() => {
    if (!progress || progress.total === 0) return 0;

    return Math.round((progress.seen / progress.total) * 100);
  }, [progress]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="h-64 animate-pulse rounded-[2rem] bg-neutral-100" />
          </div>
        </section>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h1 className="text-xl font-black">
            No se pudo cargar la práctica
          </h1>
          <p className="mt-1 text-sm font-bold">
            {err}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                🧠 Práctica constante {testerAs ? '— Modo Tester' : ''}
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Ejercicios de práctica
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Respondé las preguntas asignadas, practicá por unidad y seguí tu progreso.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Puntaje
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {score.ok}/{score.total}
                </p>
              </div>

              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-sky-500">
                  Modo
                </p>
                <p className="mt-1 text-sm font-black text-sky-800">
                  {mode === 'sets' ? 'Sets asignados' : 'Práctica general'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SELECTOR DE SET / UNIDAD */}
      {mode === 'sets' && (
        <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-neutral-950">
                Elegir práctica
              </h2>
              <p className="text-sm text-neutral-500">
                Seleccioná el set y, si querés, una unidad específica.
              </p>
            </div>

            {progress && (
              <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                {progress.seen}/{progress.total} únicos
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
            {!testerAs && (
              <label className="grid gap-1">
                <span className="text-sm font-black text-neutral-700">
                  Set
                </span>
                <select
                  value={setId}
                  onChange={e => setSetId(e.target.value)}
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                >
                  {mySets.map(r => (
                    <option key={r.set._id} value={r.set._id}>
                      {r.set.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid gap-1">
              <span className="text-sm font-black text-neutral-700">
                Unidad
              </span>
              <input
                type="number"
                min={1}
                placeholder="Opcional"
                value={unit}
                onChange={e => setUnit(e.target.value ? Number(e.target.value) : '')}
                className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <button
              onClick={startWithSet}
              disabled={!setId}
              className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              Comenzar
            </button>
          </div>

          {progress && (
            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-emerald-800">
                  Progreso del set
                </p>
                <p className="text-sm font-black text-emerald-700">
                  {pct}%
                </p>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="mt-2 text-xs font-semibold text-emerald-700">
                Viste <b>{progress.seen}</b> de <b>{progress.total}</b> preguntas únicas.
              </p>
            </div>
          )}
        </section>
      )}

      {/* FELICIDADES */}
      {mode === 'sets' && completed && (
        <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 shadow-xl shadow-emerald-100">
          <div className="text-5xl">
            🎉
          </div>

          <h2 className="mt-3 text-2xl font-black text-emerald-900">
            ¡Felicidades!
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-emerald-700">
            Completaste todas las preguntas de este set
            {unit ? <> de la unidad <b>{unit}</b></> : null}.
          </p>

          {progress && (
            <div className="mt-4 rounded-3xl border border-emerald-100 bg-white px-5 py-4 text-sm text-emerald-800">
              Viste <b>{progress.seen}</b> de <b>{progress.total}</b> preguntas únicas.
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="w-full rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-emerald-700 shadow-sm transition hover:bg-emerald-100 sm:w-auto"
              onClick={() => {
                setCompleted(false);
                setQs([]);
                setProgress(null);
              }}
            >
              {testerAs ? 'Volver a probar' : 'Elegir otro set'}
            </button>

            <button
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
              onClick={() => startWithSet()}
            >
              Repetir
            </button>
          </div>
        </section>
      )}

      {/* LEGACY INFO */}
      {mode === 'legacy' && (
        <section className="rounded-3xl border border-violet-100 bg-violet-50 px-5 py-4 text-sm font-bold text-violet-700">
          Pregunta {qs.length ? idx + 1 : 0} de {qs.length} — Puntaje: {score.ok}/{score.total}
        </section>
      )}

      {/* SIN PREGUNTAS EN SET */}
      {mode === 'sets' && qs.length === 0 && !completed && (
        <section className="rounded-[2rem] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <div className="mb-3 text-5xl">
            ✨
          </div>

          <h3 className="text-lg font-black text-neutral-800">
            Elegí una práctica para comenzar
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Seleccioná un set y presioná <b>Comenzar</b>.
          </p>
        </section>
      )}

      {/* TARJETA DE PREGUNTA */}
      {qs.length > 0 && !completed && (
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100">
          <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-neutral-500">
                  Pregunta
                </p>
                <p className="text-sm font-black text-neutral-800">
                  {idx + 1} de {qs.length} {q?.unit ? `· Unidad ${q.unit}` : ''}
                </p>
              </div>

              <span className="w-fit rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-sky-700">
                {q?.type === 'MC' ? 'Opción múltiple' : 'Respuesta escrita'}
              </span>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {q?.imageUrl && (
              <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
                <img
                  src={q.imageUrl}
                  alt=""
                  className="max-h-[480px] w-full object-contain"
                />
              </div>
            )}

            {q?.embedUrl && (
              <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
                <iframe
                  src={normalizeEmbedUrl(q.embedUrl)}
                  title="embed"
                  className="h-[260px] w-full border-0 sm:h-[360px]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  sandbox="allow-same-origin allow-scripts allow-popups allow-presentation"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            )}

            <div className="rounded-3xl border border-violet-100 bg-violet-50 px-5 py-4">
              <p className="text-lg font-black leading-relaxed text-neutral-950 sm:text-xl">
                {q?.prompt}
              </p>
            </div>

            {q?.type === 'MC' ? (
              <div className="grid gap-3">
                {(q.options || []).map(opt => (
                  <button
                    key={opt}
                    onClick={() => submit(opt)}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-left text-sm font-black text-neutral-800 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:shadow-md"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  placeholder="Tu respuesta"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  className="min-h-[54px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />

                <button
                  onClick={() => submit(answer)}
                  disabled={!answer.trim()}
                  className="min-h-[54px] w-full rounded-2xl bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Responder
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* MENSAJE CUANDO NO HAY PREGUNTAS LEGACY */}
      {mode === 'legacy' && qs.length === 0 && (
        <section className="rounded-[2rem] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <div className="mb-3 text-5xl">
            📭
          </div>

          <h3 className="text-lg font-black text-neutral-800">
            No hay preguntas disponibles
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Cuando haya ejercicios cargados, aparecerán en esta sección.
          </p>
        </section>
      )}
    </div>
  );
}

