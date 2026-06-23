import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { normalizeEmbedUrl } from '../lib/media';
import '../styles/student-practice.css';

type Q = {
  _id: string;
  prompt: string;
  type: 'MC' | 'GAP';
  options?: string[] | null;
  shuffledOptions?: string[];
  imageUrl?: string | null;
  audioUrl?: string | null;
  embedUrl?: string | null;
  unit?: number | null;
};

type Progress = {
  total: number;
  seen: number;
  remaining: number;
};

type Feedback = {
  correct: boolean;
  text: string;
  detail: string;
};

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function prepareQuestions(questions: Q[]): Q[] {
  return shuffleArray(questions).map(q => ({
    ...q,
    shuffledOptions: q.options ? shuffleArray(q.options) : [],
  }));
}

function normalizeAudioUrl(u?: string | null) {
  if (!u) return '';

  try {
    const url = new URL(u);

    if (url.hostname.includes('drive.google.com')) {
      if (url.pathname.startsWith('/file/d/')) {
        const id = url.pathname.split('/')[3];
        return id ? `https://drive.google.com/uc?export=download&id=${id}` : u;
      }

      const id = url.searchParams.get('id');
      if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    }
  } catch {}

  return u;
}

function playFeedbackSound(correct: boolean) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = correct ? 740 : 180;

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    if (correct) {
      osc.frequency.setValueAtTime(740, ctx.currentTime);
      osc.frequency.setValueAtTime(980, ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.12);
    }

    osc.stop(ctx.currentTime + 0.3);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {}
}

function speakFeedback(correct: boolean) {
  try {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(correct ? 'Well done!' : 'Try again!');
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = correct ? 1.1 : 0.9;
    utterance.volume = 0.8;

    window.speechSynthesis.speak(utterance);
  } catch {}
}

export default function StudentPractice() {
  // --- Modo tester si vienen ?as= & set=
  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();

  const testerAs = params.get('as') || '';
  const testerSet = params.get('set') || '';
  const testerUnit = params.get('unit') ? Number(params.get('unit')) : undefined;

  // --- Sets habilitados
  const [mySets, setMySets] = useState<{ set: { _id: string; title: string; units?: number }, updatedAt: string }[]>([]);
  const [setId, setSetId] = useState<string>(testerSet || '');
  const [unit, setUnit] = useState<number | ''>(typeof testerUnit === 'number' ? testerUnit : '');
  const [mode, setMode] = useState<'sets' | 'legacy'>(testerSet ? 'sets' : 'legacy');

  // --- Pantallas
  const [screen, setScreen] = useState<'choose' | 'game' | 'result'>('choose');

  // --- Juego
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameLoading, setGameLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [locked, setLocked] = useState(false);

  const q = qs[idx];

  const selectedSet = useMemo(() => {
    return mySets.find(r => r.set._id === setId)?.set || null;
  }, [mySets, setId]);

  const unitOptions = useMemo(() => {
    const total = selectedSet?.units || 0;

    if (!total || total < 1) return [];

    return Array.from({ length: total }, (_, i) => i + 1);
  }, [selectedSet]);

  const progressPct = useMemo(() => {
    if (!progress || progress.total === 0) return 0;

    return Math.round((progress.seen / progress.total) * 100);
  }, [progress]);

  const roundPct = useMemo(() => {
    if (!score.total) return 0;

    return Math.round((score.ok / score.total) * 100);
  }, [score]);

  useEffect(() => {
    (async () => {
      try {
        // 1) Modo tester directo
        if (testerAs && testerSet) {
          setMode('sets');
          setSetId(testerSet);
          setScreen('game');

          await loadBatch(testerSet, typeof testerUnit === 'number' ? testerUnit : undefined, testerAs);
          return;
        }

        // 2) Sets habilitados para alumno
        const r = await api.practice.mySets().catch(() => ({ rows: [] as any[] }));
        const rows = r?.rows || [];

        if (rows.length > 0) {
          setMySets(rows);
          setSetId(rows[0].set._id);
          setMode('sets');
          setScreen('choose');
          return;
        }

        // 3) Legacy
        setMode('legacy');
        setScreen('game');
        await loadLegacy();
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetRound() {
    setIdx(0);
    setAnswer('');
    setSelectedAnswer('');
    setScore({ ok: 0, total: 0 });
    setPoints(0);
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setLocked(false);
  }

  async function loadLegacy() {
    setGameLoading(true);
    setErr(null);

    try {
      const legacy = await api.practice.play();

      setQs(prepareQuestions(legacy.questions || []));
      setIdx(0);
      setAnswer('');
      setSelectedAnswer('');
      setCompleted(false);
      setProgress(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGameLoading(false);
    }
  }

  async function loadBatch(currentSetId: string, currentUnit?: number, asStudentId?: string) {
    setGameLoading(true);
    setErr(null);

    try {
      const r = asStudentId
        ? await api.practice.playAs(asStudentId, currentSetId, currentUnit)
        : await api.practice.playSet(currentSetId, currentUnit);

      setQs(prepareQuestions(r.questions || []));
      setIdx(0);
      setAnswer('');
      setSelectedAnswer('');
      setProgress(r.progress || null);
      setCompleted(!!r.completed);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGameLoading(false);
    }
  }

  async function startWithSet() {
    if (!setId) return;

    resetRound();
    setScreen('game');

    await loadBatch(setId, unit ? Number(unit) : undefined, testerAs || undefined);
  }

  async function restartGame() {
    resetRound();
    setScreen('game');

    if (mode === 'sets' && setId) {
      await loadBatch(setId, unit ? Number(unit) : undefined, testerAs || undefined);
    } else {
      await loadLegacy();
    }
  }

  function backToChooser() {
    setFeedback(null);
    setLocked(false);
    setAnswer('');
    setSelectedAnswer('');

    if (mode === 'sets') {
      setScreen('choose');
      setQs([]);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    setScreen('choose');
  }

  async function submit(a: string) {
    if (!q || locked || !a.trim()) return;

    setLocked(true);
    setSelectedAnswer(a);

    try {
      const res = testerAs
        ? await api.practice.submitAs(testerAs, q._id, a)
        : await api.practice.submit(q._id, a);

      const nextStreak = res.correct ? streak + 1 : 0;
      const gainedPoints = res.correct ? 10 + Math.min(nextStreak * 2, 20) : 0;

      setScore(s => ({
        ok: s.ok + (res.correct ? 1 : 0),
        total: s.total + 1,
      }));

      setStreak(nextStreak);
      setBestStreak(s => Math.max(s, nextStreak));
      setPoints(p => p + gainedPoints);

      setFeedback({
        correct: res.correct,
        text: res.correct ? 'Well done!' : 'Try again!',
        detail: res.correct
          ? `+${gainedPoints} points`
          : 'This question can appear again later.',
      });

      playFeedbackSound(res.correct);
      speakFeedback(res.correct);

      window.setTimeout(() => {
        setFeedback(null);
        setAnswer('');
        setSelectedAnswer('');
        setLocked(false);

        if (idx + 1 < qs.length) {
          setIdx(i => i + 1);
          return;
        }

        setScreen('result');
      }, 950);
    } catch (e: any) {
      setLocked(false);
      setFeedback(null);
      setErr(e.message);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 animate-pulse rounded-3xl bg-neutral-100" />

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

          <button
            onClick={() => {
              setErr(null);
              if (mode === 'sets') {
                setScreen('choose');
              } else {
                restartGame();
              }
            }}
            className="mt-5 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-rose-100"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'choose') {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 p-[2px] shadow-xl shadow-violet-100">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-5 sm:p-7 md:p-8">
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-violet-200/60 blur-3xl" />
            <div className="absolute -bottom-16 -left-14 h-52 w-52 rounded-full bg-sky-200/60 blur-3xl" />

            <div className="relative grid gap-6 md:grid-cols-[1fr_260px] md:items-center">
              <div>
                <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                  Practice game {testerAs ? '— Tester mode' : ''}
                </div>

                <h1 className="text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl md:text-5xl">
                  Choose your mission
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                  Choose a practice set, select a unit if you want, and start the game.
                  You can repeat it many times until you get a perfect score.
                </p>
              </div>

              <div className="relative mx-auto h-56 w-56">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-200 to-sky-200 blur-2xl" />

                <div className="relative flex h-full w-full items-center justify-center rounded-[3rem] border border-white bg-white/80 text-8xl shadow-xl">
                  🐉
                </div>

                <div className="absolute -bottom-2 left-1/2 w-[220px] -translate-x-1/2 rounded-3xl border border-violet-100 bg-white px-4 py-3 text-center text-sm font-black text-violet-800 shadow-lg">
                  Milo says: Let’s play!
                </div>
              </div>
            </div>
          </div>
        </section>

        {mode === 'sets' ? (
          <section className="rounded-[2.5rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-neutral-950">
                Your assigned practice
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                The activity will open in a full-screen game view.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
              {!testerAs && (
                <label className="grid gap-2">
                  <span className="text-sm font-black text-neutral-700">
                    Practice set
                  </span>

                  <select
                    value={setId}
                    onChange={e => {
                      setSetId(e.target.value);
                      setUnit('');
                    }}
                    className="min-h-[56px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  >
                    {mySets.map(r => (
                      <option key={r.set._id} value={r.set._id}>
                        {r.set.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="grid gap-2">
                <span className="text-sm font-black text-neutral-700">
                  Unit
                </span>

                {unitOptions.length > 0 ? (
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value ? Number(e.target.value) : '')}
                    className="min-h-[56px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="">All units</option>
                    {unitOptions.map(n => (
                      <option key={n} value={n}>
                        Unit {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    placeholder="Optional"
                    value={unit}
                    onChange={e => setUnit(e.target.value ? Number(e.target.value) : '')}
                    className="min-h-[56px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                )}
              </label>

              <button
                onClick={startWithSet}
                disabled={!setId}
                className="min-h-[56px] w-full rounded-2xl bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
              >
                Start game
              </button>
            </div>

            {mySets.length === 0 && !testerAs && (
              <div className="mt-5 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
                <div className="text-4xl">
                  📭
                </div>

                <h3 className="mt-2 text-lg font-black text-neutral-800">
                  No practice sets assigned yet
                </h3>

                <p className="mt-1 text-sm text-neutral-500">
                  When your teacher or coordinator enables a set, it will appear here.
                </p>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-[2rem] border border-violet-100 bg-violet-50 px-5 py-4 text-sm font-bold text-violet-700">
            General practice mode is active.
          </section>
        )}
      </div>
    );
  }

  if (screen === 'result') {
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-gradient-to-br from-sky-50 via-violet-50 to-fuchsia-50 px-4 py-5 sm:px-6">
        <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
          <section className="w-full overflow-hidden rounded-[2.5rem] border border-white bg-white/90 p-6 shadow-2xl shadow-violet-200 backdrop-blur sm:p-8">
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-violet-100 to-sky-100 text-6xl shadow-lg">
                {roundPct === 100 ? '🏆' : roundPct >= 70 ? '🎉' : '💪'}
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">
                {roundPct === 100 ? 'Perfect score!' : 'Round finished!'}
              </h1>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                {roundPct === 100
                  ? 'Excellent! You answered everything correctly.'
                  : 'Good practice! You can play again to improve your score.'}
              </p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-4">
              <div className="rounded-3xl border border-violet-100 bg-violet-50 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Score
                </p>

                <p className="mt-1 text-2xl font-black text-violet-900">
                  {score.ok}/{score.total}
                </p>
              </div>

              <div className="rounded-3xl border border-sky-100 bg-sky-50 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-sky-500">
                  Points
                </p>

                <p className="mt-1 text-2xl font-black text-sky-900">
                  {points}
                </p>
              </div>

              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-amber-500">
                  Best streak
                </p>

                <p className="mt-1 text-2xl font-black text-amber-900">
                  {bestStreak}
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-500">
                  Accuracy
                </p>

                <p className="mt-1 text-2xl font-black text-emerald-900">
                  {roundPct}%
                </p>
              </div>
            </div>

            {progress && (
              <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-emerald-800">
                    Set progress
                  </p>

                  <p className="text-sm font-black text-emerald-700">
                    {progressPct}%
                  </p>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  Mastered <b>{progress.seen}</b> of <b>{progress.total}</b> questions.
                </p>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={restartGame}
                className="rounded-2xl bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 px-7 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Play again
              </button>

              <button
                onClick={backToChooser}
                className="rounded-2xl border border-neutral-200 bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50"
              >
                Back
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-gradient-to-br from-sky-50 via-violet-50 to-fuchsia-50">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-3 py-3 sm:px-5 sm:py-5">
        {/* GAME HEADER */}
        <header className="mb-4 rounded-[2rem] border border-white bg-white/85 p-3 shadow-xl shadow-violet-100 backdrop-blur sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={backToChooser}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black text-neutral-700 shadow-sm transition hover:bg-neutral-50"
              >
                ← Back
              </button>

              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-sky-100 text-3xl shadow-sm">
                  🐉
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-neutral-950 sm:text-base">
                    {mode === 'sets'
                      ? selectedSet?.title || 'Practice game'
                      : 'General practice'}
                  </p>

                  <p className="text-xs font-bold text-neutral-500">
                    {q?.unit ? `Unit ${q.unit}` : unit ? `Unit ${unit}` : 'All units'}
                    {completed ? ' · Replay mode' : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-2 sm:flex-none sm:grid-cols-3">
              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-wide text-violet-500">
                  Score
                </p>

                <p className="text-sm font-black text-violet-900">
                  {score.ok}/{score.total}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-wide text-sky-500">
                  Points
                </p>

                <p className="text-sm font-black text-sky-900">
                  {points}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-wide text-amber-500">
                  Streak
                </p>

                <p className="text-sm font-black text-amber-900">
                  {streak}
                </p>
              </div>
            </div>
          </div>

          {progress && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs font-black text-neutral-500">
                <span>
                  Progress
                </span>

                <span>
                  {progress.seen}/{progress.total}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </header>

        {/* GAME BODY */}
        <main className="flex flex-1 items-stretch">
          <section className="grid w-full gap-4 lg:grid-cols-[1fr_280px]">
            <div className="overflow-hidden rounded-[2.5rem] border border-white bg-white/90 shadow-2xl shadow-violet-100 backdrop-blur">
              {gameLoading ? (
                <div className="flex min-h-[520px] items-center justify-center p-8">
                  <div className="text-center">
                    <div className="mx-auto h-16 w-16 animate-pulse rounded-[2rem] bg-violet-100" />

                    <p className="mt-4 text-sm font-black text-neutral-500">
                      Loading game...
                    </p>
                  </div>
                </div>
              ) : qs.length === 0 ? (
                <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
                  <div>
                    <div className="text-6xl">
                      📭
                    </div>

                    <h2 className="mt-4 text-2xl font-black text-neutral-900">
                      No questions available
                    </h2>

                    <p className="mt-2 max-w-md text-sm text-neutral-500">
                      This set or unit does not have questions yet.
                    </p>

                    <button
                      onClick={backToChooser}
                      className="mt-6 rounded-2xl bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-6">
                  <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                        Question {idx + 1} of {qs.length}
                      </p>

                      <h2 className="mt-1 text-xl font-black text-neutral-950 sm:text-2xl">
                        Choose the best answer
                      </h2>
                    </div>

                    <span className="w-fit rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-sky-700">
                      {q?.type === 'MC' ? 'Multiple choice' : 'Written answer'}
                    </span>
                  </div>

                  <div className="space-y-5">
                    {q?.imageUrl && (
                      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
                        <img
                          src={q.imageUrl}
                          alt=""
                          className="max-h-[420px] w-full object-contain"
                        />
                      </div>
                    )}

                    {q?.audioUrl && (
                      <div className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-sky-700">
                          Listen
                        </p>

                        <audio
                          controls
                          src={normalizeAudioUrl(q.audioUrl)}
                          className="w-full"
                        />

                        <a
                          href={q.audioUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-xs font-bold text-sky-700 underline"
                        >
                          Open audio link
                        </a>
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

                    <div className="rounded-3xl border border-violet-100 bg-violet-50 px-5 py-5">
                      <p className="text-xl font-black leading-relaxed text-neutral-950 sm:text-2xl">
                        {q?.prompt}
                      </p>
                    </div>

                    {feedback && (
                      <div
                        className={[
                          'rounded-3xl border px-5 py-4 shadow-sm',
                          feedback.correct
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-rose-200 bg-rose-50 text-rose-800',
                        ].join(' ')}
                      >
                        <p className="text-lg font-black">
                          {feedback.correct ? '✅' : '❌'} {feedback.text}
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          {feedback.detail}
                        </p>
                      </div>
                    )}

                    {q?.type === 'MC' ? (
                      <div className="grid gap-3">
                        {(q.shuffledOptions || []).map((opt, optIdx) => {
                          const isSelected = selectedAnswer === opt;

                          return (
                            <button
                              key={`${opt}-${optIdx}`}
                              onClick={() => submit(opt)}
                              disabled={locked}
                              className={[
                                'w-full rounded-2xl border px-5 py-4 text-left text-sm font-black shadow-sm transition sm:text-base',
                                locked
                                  ? 'cursor-not-allowed opacity-80'
                                  : 'hover:-translate-y-0.5 hover:shadow-md',
                                isSelected && feedback?.correct
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : '',
                                isSelected && feedback && !feedback.correct
                                  ? 'border-rose-300 bg-rose-50 text-rose-900'
                                  : '',
                                !isSelected
                                  ? 'border-neutral-200 bg-white text-neutral-800 hover:border-violet-200 hover:bg-violet-50'
                                  : '',
                              ].join(' ')}
                            >
                              <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-xs font-black text-neutral-600">
                                {String.fromCharCode(65 + optIdx)}
                              </span>

                              {opt}
                            </button>
                          );
                        })}

                        {(q.shuffledOptions || []).length === 0 && (
                          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
                            This multiple choice question has no options loaded.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          placeholder="Your answer"
                          value={answer}
                          onChange={e => setAnswer(e.target.value)}
                          disabled={locked}
                          className="min-h-[58px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:opacity-70"
                        />

                        <button
                          onClick={() => submit(answer)}
                          disabled={!answer.trim() || locked}
                          className="min-h-[58px] w-full rounded-2xl bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                          Answer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* MASCOT SIDE PANEL */}
            <aside className="hidden rounded-[2.5rem] border border-white bg-white/80 p-5 shadow-xl shadow-violet-100 backdrop-blur lg:block">
              <div className="sticky top-5">
                <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-[3rem] bg-gradient-to-br from-violet-100 to-sky-100 text-8xl shadow-inner">
                  🐉
                </div>

                <div className="mt-5 rounded-3xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-sm font-black text-violet-900">
                    Milo tip
                  </p>

                  <p className="mt-1 text-sm leading-relaxed text-violet-700">
                    Read carefully, listen to the audio if there is one, and choose the best option.
                  </p>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-3xl border border-neutral-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
                      Current question
                    </p>

                    <p className="mt-1 text-lg font-black text-neutral-900">
                      {qs.length ? idx + 1 : 0}/{qs.length}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-neutral-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
                      Accuracy
                    </p>

                    <p className="mt-1 text-lg font-black text-neutral-900">
                      {roundPct}%
                    </p>
                  </div>

                  <div className="rounded-3xl border border-neutral-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
                      Best streak
                    </p>

                    <p className="mt-1 text-lg font-black text-neutral-900">
                      {bestStreak}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
