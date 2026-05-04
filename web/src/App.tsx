import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, type Me } from './lib/api';
import './styles/responsive.css';
import type { MyCourseRow, CourseScheduleItem, DayCode } from './lib/api';
import {
  Menu,
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  ClipboardList,
  FileText,
  Mail,
  BarChart3,
  Settings,
  Search,
  GraduationCap,
  Sun,
  Moon,
} from 'lucide-react';

/* Páginas */
import CoordinatorCourses from './pages/CoordinatorCourses';
import CoordinatorCourseManage from './pages/CoordinatorCourseManage';
import CoordinatorCoursePractice from './pages/CoordinatorCoursePractice';
import CoordinatorCourseSchedule from './pages/CoordinatorCourseSchedule';
import CoordinatorStudentSearch from './pages/CoordinatorStudentSearch';
import CoordinatorUsers from './pages/CoordinatorUsers';

import TeacherCourses from './pages/TeacherCourses';
import AttendancePage from './pages/AttendancePage';
import TeacherCoursePartials from './pages/TeacherCoursePartials';
import TeacherCourseReport from './pages/TeacherCourseReport';
import TeacherCourseReportPrint from './pages/TeacherCourseReportPrint';
import CourseTopicsPage from './pages/CourseTopicsPage';
import CourseMaterialsPage from './pages/CourseMaterialsPage';

import StudentProfile from './pages/StudentProfile';
import StudentCommunications from './pages/StudentCommunications';
import StudentPartialCards from './pages/StudentPartialCards';
import StudentFinalCards from './pages/StudentFinalCards';
import PrintFinalReport from './pages/PrintFinalReport';
import StudentPractice from './pages/StudentPractice';
import StudentBritishExam from './pages/StudentBritishExam';

/* ➕ NUEVO: británico curso (coordinador/teacher) */
import CoordinatorBritishCourse from './pages/CoordinatorBritishCourse';

/* ➕ NUEVO: Comunicaciones unificada */
import Communications from './pages/Communications';

/* ➕ NUEVO: Listado de alumnos del docente */
import TeacherStudents from './pages/TeacherStudents';

/* ➕ NUEVO: Alumnos de un curso específico del profe */
import TeacherCourseStudents from './pages/TeacherCourseStudents';

/* ➕ NUEVO: Casos (seguimiento) coord/admin */
import StaffCases from './pages/StaffCases';

/* ➕ NUEVO: Asistencia/Bajas coord/admin */
import AttendanceDrops from './pages/AttendanceDrops';

/* ➕ Imagen de fondo para Login (mantén el nombre real del archivo) */
import hero from './assets/login-hero.jpg.png';

/* ➕ NUEVO: Card de asistencias del estudiante */
import StudentAttendanceCard from './components/StudentAttendanceCard';

/* ➕ NUEVO: Campanita con contador */
import NotifBell from './components/NotifBell';

/* ➕ NUEVO: Material alumnos (páginas) */
import CourseStudentMaterials from './pages/CourseStudentMaterials';
import StudentMaterials from './pages/StudentMaterials';

/* ➕ NUEVO: Tablón del curso */
import CourseBoardPage from './pages/CourseBoardPage';

/* ➕ NUEVO: Sets de práctica (coord/admin/teacher) */
import CoordinatorPracticeSets from './pages/CoordinatorPracticeSets';

/* ➕ NUEVO: Exámenes modelos */
import ExamModels from './pages/ExamModels';

/* ------- Utiles ------- */
const L: Record<DayCode, string> = {
  MON: 'Lun',
  TUE: 'Mar',
  WED: 'Mié',
  THU: 'Jue',
  FRI: 'Vie',
  SAT: 'Sáb',
};

/* ===== Toggle de Tema (persistente) ===== */
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';

    const saved = localStorage.getItem('theme');

    if (saved === 'light' || saved === 'dark') return saved;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm
                 hover:bg-neutral-100 dark:hover:bg-slate-800 focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary"
      aria-label="Cambiar tema"
      title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span className="hidden sm:inline">
        {theme === 'dark' ? 'Claro' : 'Oscuro'}
      </span>
    </button>
  );
}

function useMe() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ok = true;

    (async () => {
      try {
        const r = await api.me();

        if (ok) setMe(r.user);
      } catch {
        if (ok) setMe(null);
      } finally {
        if (ok) setLoading(false);
      }
    })();

    return () => {
      ok = false;
    };
  }, []);

  return {
    me,
    loading,
    refresh: async () => {
      const r = await api.me().catch(() => null);
      setMe(r?.user ?? null);
    },
  };
}

/* ------- Layout (Shell Global-T) ------- */
function Shell() {
  const { me, loading } = useMe();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  // 🔎 estado del buscador global
  const [globalQ, setGlobalQ] = useState('');

  const doGlobalSearch = () => {
    const q = globalQ.trim();

    if (!q) return;

    nav(`/coordinator/students?q=${encodeURIComponent(q)}`);
  };

  const navItems = useMemo(() => {
    const items: { to: string; label: string; icon: any; show: boolean }[] = [
      {
        to: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        show: true,
      },
      {
        to: '/coordinator/courses',
        label: me?.role === 'admin' ? 'Cursos (Admin)' : 'Cursos',
        icon: BookOpen,
        show: me?.role === 'coordinator' || me?.role === 'admin',
      },
      {
        to: '/coordinator/users',
        label: 'Personas',
        icon: Users,
        show: me?.role === 'coordinator' || me?.role === 'admin',
      },
      {
        to: '/teacher/courses',
        label: 'Mis cursos',
        icon: ClipboardList,
        show: me?.role === 'teacher',
      },
      {
        to: '/teacher/students',
        label: 'Alumnos',
        icon: Users,
        show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin',
      },
      /* ➕ NUEVO: Crear Sets (visible para teacher/coord, NO admin) */
      {
        to: '/coordinator/practice/sets',
        label: 'Crear sets',
        icon: Settings,
        show: me?.role === 'teacher' || me?.role === 'coordinator',
      },
      /* ➕ NUEVO: Práctica (curso) en el sidebar para coord/teacher, NO admin */
      {
        to: '/coordinator/courses',
        label: 'Práctica (curso)',
        icon: BookOpen,
        show: me?.role === 'teacher' || me?.role === 'coordinator',
      },
      /* ➕ NUEVO: Exámenes modelos (visible para TODOS los roles logueados) */
      {
        to: '/exam-models',
        label: 'Exámenes modelos',
        icon: ClipboardList,
        show: !!me,
      },
      {
        to: '/communications',
        label: 'Comunicaciones',
        icon: Mail,
        show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin',
      },
      {
        to: '/staff/cases',
        label: 'Casos',
        icon: ClipboardList,
        show: me?.role === 'coordinator' || me?.role === 'admin',
      },
      {
        to: '/staff/attendance-drops',
        label: 'Asistencia/Bajas',
        icon: ClipboardList,
        show: me?.role === 'coordinator' || me?.role === 'admin',
      },
      {
        to: '/me',
        label: 'Mi perfil',
        icon: UserCog,
        show: !!me,
      },
      {
        to: '/student/communications',
        label: 'Comunicaciones',
        icon: Mail,
        show: me?.role === 'student',
      },
      {
        to: '/student/partials',
        label: 'Informes parciales',
        icon: FileText,
        show: me?.role === 'student',
      },
      {
        to: '/student/finals',
        label: 'Boletín',
        icon: BarChart3,
        show: me?.role === 'student',
      },
      {
        to: '/student/british',
        label: 'Británico',
        icon: GraduationCap,
        show: me?.role === 'student',
      },
      {
        to: '/student/practice',
        label: 'Práctica',
        icon: Settings,
        show: me?.role === 'student',
      },
      /* ➕ agregado: Materiales (alumnos) en el sidebar del alumno */
      {
        to: '/student/materials',
        label: 'Materiales',
        icon: BookOpen,
        show: me?.role === 'student',
      },
    ];

    return items.filter(i => i.show);
  }, [me]);

  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-3 md:px-6 h-14 flex items-center gap-3">
          <button
            aria-label="Abrir menú"
            className="md:hidden btn btn-secondary !px-2 !py-2"
            onClick={() => setOpen(s => !s)}
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-xl"
              style={{ background: 'var(--grad-brand)' }}
            />
            <span className="font-heading font-bold">Global-T</span>
          </div>

          {(me?.role === 'coordinator' || me?.role === 'admin') && (
            <div className="flex-1 max-w-xl mx-auto hidden md:flex">
              <label className="relative w-full" aria-label="Búsqueda global">
                <Search className="absolute left-3 top-2.5" size={18} />

                <input
                  className="input pl-9 pr-24"
                  placeholder="Buscar por Nombre, DNI o Curso…"
                  value={globalQ}
                  onChange={e => setGlobalQ(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') doGlobalSearch();
                  }}
                />

                <button
                  className="absolute right-1 top-1 btn btn-secondary !px-3 !py-1.5"
                  onClick={doGlobalSearch}
                >
                  Buscar
                </button>
              </label>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* ⬇️ Toggle de tema global */}
            <ThemeToggle />

            {/* ⬇️ Campanita con contador */}
            <NotifBell
              onClick={() => {
                if (me?.role === 'student') nav('/student/communications');
                else nav('/communications');
              }}
            />

            {loading ? (
              <div className="h-8 w-24 skeleton" />
            ) : me ? (
              <button
                className="h-8 px-3 rounded-xl text-white font-medium"
                style={{ background: 'var(--brand-deep)' }}
                onClick={async () => {
                  await api.logout();
                  nav('/login');
                }}
                title={`Salir (${me.email})`}
              >
                Salir
              </button>
            ) : (
              <Link className="btn btn-primary !px-3 !py-2" to="/login">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl w-full grid grid-cols-1 md:grid-cols-[240px,1fr] gap-4 px-3 md:px-6 py-4">
        {/* Sidebar */}
        <aside className={(open ? 'block' : 'hidden') + ' md:block card h-fit md:sticky md:top-16 p-2 md:p-3'}>
          <nav className="flex flex-col">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = loc.pathname === item.to || (item.to !== '/' && loc.pathname.startsWith(item.to));

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={
                    'flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-50 dark:hover:bg-slate-800 ' +
                    (active ? 'bg-neutral-50 dark:bg-slate-800 font-medium' : '')
                  }
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ------- Páginas simples ------- */
function Home() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  // "Mis cursos" del backend
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<MyCourseRow[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [errCourses, setErrCourses] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.me();
        setMe(r.user);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!me || me.role !== 'student') return;

      setLoadingCourses(true);
      setErrCourses(null);

      try {
        const resp = await api.courses.mine();
        setYear(resp.year);
        setRows(resp.rows || []);
      } catch (e: any) {
        setErrCourses(e?.message || 'No se pudo cargar tus cursos.');
      } finally {
        setLoadingCourses(false);
      }
    })();
  }, [me]);

  const fmtItem = (it: CourseScheduleItem) =>
    `${it.day ? (L[it.day] + ' ') : ''}${it.start}-${it.end}`;

  const campusLabel = me?.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz';

  const roleLabel =
    me?.role === 'student'
      ? 'Alumno'
      : me?.role === 'teacher'
        ? 'Docente'
        : me?.role === 'coordinator'
          ? 'Coordinación'
          : me?.role === 'admin'
            ? 'Administración'
            : 'Usuario';

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="h-36 animate-pulse rounded-[2rem] bg-neutral-100" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* INICIO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-700 via-indigo-700 to-sky-600 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative">
            <div className="mb-3 flex w-fit items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
              <LayoutDashboard size={14} />
              Inicio
            </div>

            {!me ? (
              <>
                <h1 className="break-words text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                  Inicio
                </h1>

                <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                  <p className="text-sm font-semibold text-neutral-700">
                    No estás logueado.
                  </p>

                  <Link
                    className="mt-3 inline-flex rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white no-underline shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl"
                    to="/login"
                  >
                    Ir a Login
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="break-words text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                  Hola, {me.name}
                </h1>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                      Rol
                    </p>
                    <p className="mt-1 text-base font-black text-violet-800">
                      {roleLabel}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-sky-100 bg-sky-50/80 px-5 py-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-wide text-sky-500">
                      Sede
                    </p>
                    <p className="mt-1 text-base font-black text-sky-800">
                      {campusLabel}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* MIS CURSOS Y HORARIOS */}
      {me?.role === 'student' && (
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100">
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-indigo-700 to-sky-600 px-5 py-5 text-white sm:px-6">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-black/15 blur-2xl" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-lg shadow-black/10">
                  <BookOpen size={24} />
                </div>

                <div className="min-w-0">
                  <h2 className="break-words text-xl font-black leading-tight text-white sm:text-2xl">
                    Mis cursos y horarios
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-white/85">
                    Ciclo lectivo {year}
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                {rows.length} curso{rows.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {loadingCourses && (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
                <div className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
              </div>
            )}

            {errCourses && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                {errCourses}
              </div>
            )}

            {!loadingCourses && !errCourses && (
              rows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                  <div className="mb-3 flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
                      <BookOpen size={28} />
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-neutral-800">
                    Aún no estás matriculado en cursos
                  </h3>

                  <p className="mt-1 text-sm text-neutral-500">
                    Cuando tengas cursos activos, van a aparecer en esta sección.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {rows.map(({ course, schedule }) => (
                    <article
                      key={course._id}
                      className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words text-lg font-black text-neutral-950 sm:text-xl">
                            {course.name}
                          </h3>

                          <p className="mt-1 text-sm font-semibold text-neutral-600">
                            {Array.isArray(schedule) && schedule.length
                              ? schedule.map(it => fmtItem(it)).join(' · ')
                              : 'Sin horarios'}
                          </p>
                        </div>

                        <Link
                          to={`/student/course/${course._id}/board`}
                          className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white no-underline shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl lg:w-auto"
                        >
                          Muro del curso
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* ASISTENCIAS */}
      {me?.role === 'student' && (
        <section className="space-y-4">
          <div id="asistencias" />

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-neutral-950">
                  Mi asistencia
                </h2>
                <p className="text-sm text-neutral-500">
                  Resumen de presentes, ausentes, justificadas, tardes y porcentaje.
                </p>
              </div>

              <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                Seguimiento
              </span>
            </div>

            <StudentAttendanceCard />
          </div>
        </section>
      )}
    </div>
  );
}

/* ===== Login inline (se mantiene la lógica original + fondo imagen) ===== */
function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('profe@inst.test');
  const [password, setPassword] = useState('profe123');
  const [err, setErr] = useState<string | null>(null);

  return (
    <main className="relative min-h-screen grid place-items-center px-4 overflow-hidden">
      {/* Fondo imagen a pantalla completa */}
      <img
        src={hero}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay para legibilidad (claro/oscuro) */}
      <div
        aria-hidden="true"
        className="absolute inset-0
                   bg-gradient-to-br from-[#0b1025]/70 via-[#0b1025]/40 to-fuchsia-700/25
                   dark:from-black/70 dark:via-black/55 dark:to-black/35"
      />

      {/* Card original */}
      <div className="relative z-10 max-w-md w-full">
        <div className="card p-4">
          {/* Branding arriba del login */}
          <div
            className="mb-4 rounded-xl px-4 py-3 text-white shadow-sm"
            style={{ background: 'var(--grad-primary)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-6 w-6 rounded-lg"
                style={{ background: 'var(--grad-brand)' }}
              />

              <div className="leading-tight">
                <div className="text-xs font-medium opacity-90 tracking-wide">
                  GLOBAL-T
                </div>
                <div className="text-sm font-semibold">
                  CAMPUS INGLÉS
                </div>
              </div>
            </div>
          </div>

          {/* título + toggle visible */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <h1 className="font-heading text-xl">Login</h1>
            <ThemeToggle />
          </div>

          <div className="flex flex-col gap-3">
            <input
              className="input"
              placeholder="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />

            <input
              className="input"
              type="password"
              placeholder="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  setErr(null);
                  await api.login(email, password);
                  nav('/');
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
            >
              Entrar
            </button>

            {err && <div className="text-danger">{err}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------- App (rutas) ------- */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login sin shell */}
        <Route path="/login" element={<Login />} />

        {/* Resto dentro del shell */}
        <Route element={<Shell />}>
          <Route index element={<Home />} />

          {/* Coordinador */}
          <Route path="/coordinator/courses" element={<CoordinatorCourses />} />
          <Route path="/coordinator/course/:id/manage" element={<CoordinatorCourseManage />} />
          <Route path="/coordinator/course/:id/practice" element={<CoordinatorCoursePractice />} />
          <Route path="/coordinator/course/:id/schedule" element={<CoordinatorCourseSchedule />} />
          <Route path="/coordinator/students" element={<CoordinatorStudentSearch />} />
          <Route path="/coordinator/users" element={<CoordinatorUsers />} />

          {/* ➕ NUEVO: Sets de práctica */}
          <Route path="/coordinator/practice/sets" element={<CoordinatorPracticeSets />} />

          {/* Alias operativos */}
          <Route path="/coordinator/course/:id/attendance" element={<AttendancePage />} />
          <Route path="/coordinator/course/:id/partials" element={<TeacherCoursePartials />} />
          <Route path="/coordinator/course/:id/boletin" element={<TeacherCourseReport />} />
          <Route path="/coordinator/course/:id/report" element={<TeacherCourseReport />} />
          <Route path="/coordinator/course/:id/topics" element={<CourseTopicsPage />} />
          <Route path="/coordinator/course/:id/materials" element={<CourseMaterialsPage />} />

          {/* ➕ NUEVO: Material alumnos (edición) */}
          <Route path="/coordinator/course/:id/student-materials" element={<CourseStudentMaterials />} />

          {/* ➕ NUEVO: Británico (edición) */}
          <Route path="/coordinator/course/:id/british" element={<CoordinatorBritishCourse mode="edit" />} />

          {/* ➕ NUEVO: Tablón (coordinador) */}
          <Route path="/coordinator/course/:id/board" element={<CourseBoardPage />} />

          {/* Profesor */}
          <Route path="/teacher/courses" element={<TeacherCourses />} />
          <Route path="/teacher/students" element={<TeacherStudents />} />

          {/* ➕ NUEVO: alumnos por curso del profe */}
          <Route path="/teacher/course/:id/students" element={<TeacherCourseStudents />} />
          <Route path="/teacher/course/:id/attendance" element={<AttendancePage />} />
          <Route path="/teacher/course/:id/partials" element={<TeacherCoursePartials />} />
          <Route path="/teacher/course/:id/boletin" element={<TeacherCourseReport />} />
          <Route path="/teacher/course/:id/boletin/preview" element={<TeacherCourseReportPrint />} />
          <Route path="/teacher/course/:id/report" element={<TeacherCourseReport />} />
          <Route path="/teacher/course/:id/topics" element={<CourseTopicsPage />} />
          <Route path="/teacher/course/:id/materials" element={<CourseMaterialsPage />} />

          {/* ➕ NUEVO: Británico (solo lectura para el profe) */}
          <Route path="/teacher/course/:id/british" element={<CoordinatorBritishCourse mode="view" />} />

          {/* ➕ NUEVO: Tablón (docente) */}
          <Route path="/teacher/course/:id/board" element={<CourseBoardPage />} />

          {/* ➕ NUEVO: Comunicaciones unificada */}
          <Route path="/communications" element={<Communications />} />

          {/* ➕ NUEVO: Casos (seguimiento) coord/admin */}
          <Route path="/staff/cases" element={<StaffCases />} />

          {/* ➕ NUEVO: Asistencia/Bajas coord/admin */}
          <Route path="/staff/attendance-drops" element={<AttendanceDrops />} />

          {/* Perfil para TODOS */}
          <Route path="/me" element={<StudentProfile />} />
          <Route path="/student/profile" element={<StudentProfile />} />

          {/* Alumno */}
          <Route path="/student/communications" element={<StudentCommunications />} />
          <Route path="/student/partials" element={<StudentPartialCards />} />
          <Route path="/student/finals" element={<StudentFinalCards />} />
          <Route path="/student/british" element={<StudentBritishExam />} />
          <Route path="/student/practice" element={<StudentPractice />} />

          {/* ➕ NUEVO: Material alumnos (vista) */}
          <Route path="/student/materials" element={<StudentMaterials />} />

          {/* ➕ NUEVO: Tablón (alumno) */}
          <Route path="/student/course/:id/board" element={<CourseBoardPage />} />

          {/* ➕ NUEVO: Exámenes modelos (TODOS los roles) */}
          <Route path="/exam-models" element={<ExamModels />} />

          {/* Imprimible A4 específico */}
          <Route path="/print/final/:courseId/:studentId" element={<PrintFinalReport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
