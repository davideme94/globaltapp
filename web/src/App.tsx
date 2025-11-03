import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, type Me } from './lib/api';
import './styles/responsive.css';
import type { MyCourseRow, CourseScheduleItem, DayCode } from './lib/api';
import {
  Menu, LayoutDashboard, Users, UserCog, BookOpen, ClipboardList,
  FileText, Mail, BarChart3, Settings, Search, GraduationCap, Sun, Moon
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
const L: Record<DayCode, string> = { MON:'Lun', TUE:'Mar', WED:'Mié', THU:'Jue', FRI:'Vie', SAT:'Sáb' };

/* ===== Toggle de Tema (persistente) ===== */
function ThemeToggle() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
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
      {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/> }
      <span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}

function useMe() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let ok = true;
    (async () => {
      try { const r = await api.me(); if (ok) setMe(r.user); }
      catch { if (ok) setMe(null); }
      finally { if (ok) setLoading(false); }
    })();
    return ()=>{ ok = false; };
  }, []);
  return { me, loading, refresh: async () => { const r = await api.me().catch(()=>null); setMe(r?.user ?? null); } };
}

/* ------- Layout (Shell Global-T) ------- */
function Shell() {
  const { me, loading } = useMe();
  const [open, setOpen] = useState(true);
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
    const items: { to:string; label:string; icon:any; show:boolean }[] = [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
      { to: '/coordinator/courses', label: 'Cursos', icon: BookOpen, show: me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/coordinator/users', label: 'Personas', icon: Users, show: me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/teacher/courses', label: 'Mis cursos', icon: ClipboardList, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/teacher/students', label: 'Alumnos', icon: Users, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      /* ➕ NUEVO: Crear Sets (visible para teacher/coord/admin) */
      { to: '/coordinator/practice/sets', label: 'Crear sets', icon: Settings, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      /* ➕ NUEVO: Práctica (curso) en el sidebar para coord/teacher/admin */
      { to: '/coordinator/courses', label: 'Práctica (curso)', icon: BookOpen, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      /* ➕ NUEVO: Exámenes modelos (visible para TODOS los roles logueados) */
      { to: '/exam-models', label: 'Exámenes modelos', icon: ClipboardList, show: !!me },
      { to: '/communications', label: 'Comunicaciones', icon: Mail, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/staff/cases', label: 'Casos', icon: ClipboardList, show: me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/me', label: 'Mi perfil', icon: UserCog, show: !!me },
      { to: '/student/communications', label: 'Comunicaciones', icon: Mail, show: me?.role === 'student' },
      { to: '/student/partials', label: 'Informes parciales', icon: FileText, show: me?.role === 'student' },
      { to: '/student/finals', label: 'Boletín', icon: BarChart3, show: me?.role === 'student' },
      { to: '/student/british', label: 'Británico', icon: GraduationCap, show: me?.role === 'student' },
      { to: '/student/practice', label: 'Práctica', icon: Settings, show: me?.role === 'student' },
      /* ➕ agregado: Materiales (alumnos) en el sidebar del alumno */
      { to: '/student/materials', label: 'Materiales', icon: BookOpen, show: me?.role === 'student' },
    ];
    return items.filter(i => i.show);
  }, [me]);

  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-3 md:px-6 h-14 flex items-center gap-3">
          <button aria-label="Abrir menú" className="md:hidden btn btn-secondary !px-2 !py-2" onClick={()=>setOpen(s=>!s)}>
            <Menu size={20}/>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl" style={{background:'var(--grad-brand)'}}/>
            <span className="font-heading font-bold">Global-T</span>
          </div>

          {(me?.role === 'coordinator' || me?.role === 'admin') && (
            <div className="flex-1 max-w-xl mx-auto hidden md:flex">
              <label className="relative w-full" aria-label="Búsqueda global">
                <Search className="absolute left-3 top-2.5" size={18}/>
                <input
                  className="input pl-9 pr-24"
                  placeholder="Buscar por Nombre, DNI o Curso…"
                  value={globalQ}
                  onChange={e=>setGlobalQ(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') doGlobalSearch(); }}
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
            <NotifBell onClick={() => {
              if (me?.role === 'student') nav('/student/communications');
              else nav('/communications');
            }} />
            {loading ? (
              <div className="h-8 w-24 skeleton" />
            ) : me ? (
              <button
                className="h-8 px-3 rounded-xl text-white font-medium"
                style={{ background: 'var(--brand-deep)' }}
                onClick={async ()=>{ await api.logout(); nav('/login'); }}
                title={`Salir (${me.email})`}
              >
                Salir
              </button>
            ) : (
              <Link className="btn btn-primary !px-3 !py-2" to="/login">Login</Link>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl w-full grid grid-cols-1 md:grid-cols-[240px,1fr] gap-4 px-3 md:px-6 py-4">
        {/* Sidebar */}
        <aside className={(open ? 'block' : 'hidden') + ' md:block card h-fit md:sticky md:top-16 p-2 md:p-3'}>
          <nav className="flex flex-col">
            {navItems.map(item=>{
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
                  <Icon size={18}/><span>{item.label}</span>
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
  the: {
  }
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<MyCourseRow[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [errCourses, setErrCourses] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.me(); setMe(r.user); }
      catch { setMe(null); }
      finally { setLoading(false); }
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
      } catch (e:any) {
        setErrCourses(e?.message || 'No se pudo cargar tus cursos.');
      } finally {
        setLoadingCourses(false);
      }
    })();
  }, [me]);

  const fmtItem = (it: CourseScheduleItem) =>
    `${it.day ? (L[it.day] + ' ') : ''}${it.start}-${it.end}`;

  if (loading) return <div className="p-4"><div className="h-6 w-32 skeleton mb-3"/><div className="h-24 skeleton"/></div>;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="font-heading text-xl">Inicio</h1>
        {!me ? (
          <div className="mt-2">
            <p>No estás logueado.</p>
            <Link className="btn btn-primary mt-2 inline-flex" to="/login">Ir a Login</Link>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <div>
              Hola, <b>{me.name}</b> — rol: <b>{me.role}</b>{' '}
              — sede:{' '}
              <span className={'badge ' + (me.campus === 'DERQUI' ? 'badge-derqui' : 'badge-jcp')}>
                {me.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz'}
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(me.role === 'coordinator' || me.role === 'admin') && <Link className="btn btn-secondary" to="/coordinator/courses">Cursos (coord)</Link>}
              {(me.role === 'coordinator' || me.role === 'admin') && <Link className="btn btn-secondary" to="/coordinator/students">Buscar alumno</Link>}
              {(me.role === 'coordinator' || me.role === 'admin') && <Link className="btn btn-secondary" to="/coordinator/users">Personas</Link>}
              {(me.role === 'teacher' || me.role === 'coordinator' || me?.role === 'admin') && <Link className="btn btn-secondary" to="/teacher/courses">Mis cursos</Link>}
              {(me.role === 'teacher' || me.role === 'coordinator' || me?.role === 'admin') && <Link className="btn btn-secondary" to="/teacher/students">Alumnos</Link>}
              {(me.role === 'teacher' || me.role === 'coordinator' || me?.role === 'admin') && <Link className="btn btn-secondary" to="/communications">Comunicaciones</Link>}
              {/* ➕ NUEVO: Acceso rápido Crear Sets para docentes */}
              {(me.role === 'teacher' || me.role === 'coordinator' || me?.role === 'admin') && (
                <Link className="btn btn-secondary" to="/coordinator/practice/sets">Crear sets</Link>
              )}
              {me && <Link className="btn btn-secondary" to="/me">Mi perfil</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/communications">Comunicaciones</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/partials">Informes parciales</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/finals">Boletín</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/british">Británico</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/practice">Práctica</Link>}
              {/* ➕ NUEVO: acceso rápido a Materiales (alumnos) */}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/materials">Materiales</Link>}
            </div>
          </div>
        )}
      </div>

      {/* Mis cursos y horarios */}
      {me?.role === 'student' && (
        <div className="card p-4">
          <div className="font-heading mb-2">Mis cursos y horarios ({year})</div>
          {loadingCourses && <div className="text-neutral-700">Cargando…</div>}
          {errCourses && <div className="text-danger">{errCourses}</div>}
          {!loadingCourses && !errCourses && (
            rows.length === 0 ? (
              <div className="text-neutral-700">Aún no estás matriculado en cursos o no tienen horarios cargados.</div>
            ) : (
              <ul className="list-disc pl-6">
                {rows.map(({ course, schedule }) => (
                  <li key={course._id} className="mb-1">
                    <b>{course.name}</b> —{' '}
                    {Array.isArray(schedule) && schedule.length
                      ? schedule.map(it => fmtItem(it)).join(' · ')
                      : 'Sin horarios'}{' '}
                    · <Link to={`/student/course/${course._id}/board`} className="text-brand-primary underline">MURO DEL CURSO</Link>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}

      {/* ➕ NUEVO: Sección Asistencias para el alumno */}
      {me?.role === 'student' && (
        <div className="mt-4">
          <div id="asistencias" />
          <StudentAttendanceCard />
        </div>
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
              <div className="h-6 w-6 rounded-lg" style={{ background: 'var(--grad-brand)' }} />
              <div className="leading-tight">
                <div className="text-xs font-medium opacity-90 tracking-wide">GLOBAL-T</div>
                <div className="text-sm font-semibold">CAMPUS INGLÉS</div>
              </div>
            </div>
          </div>

          {/* título + toggle visible */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <h1 className="font-heading text-xl">Login</h1>
            <ThemeToggle />
          </div>

          <div className="flex flex-col gap-3">
            <input className="input" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="input" type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
            <button
              className="btn btn-primary"
              onClick={async () => {
                try { setErr(null); await api.login(email, password); nav('/'); }
                catch (e:any) { setErr(e.message); }
              }}>
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

          {/* Perfil para TODOS */}
          <Route path="/me" element={<StudentProfile />} />
          <Route path="/student/profile" element={<StudentProfile />} /> {/* compat viejo */}

          {/* Alumno */}
          <Route path="/student/communications" element={<StudentCommunications />} />
          <Route path="/student/partials" element={<StudentPartialCards />} />
          <Route path="/student/finals" element={<StudentFinalCards />} />
          <Route path="/student/british" element={<StudentBritishExam />} /> {/* NUEVO */}
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
