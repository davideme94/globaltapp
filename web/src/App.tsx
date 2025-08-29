// src/App.tsx
import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, type Me } from './lib/api';
import type { MyCourseRow, CourseScheduleItem, DayCode } from './lib/api';
import {
  Menu, Bell, LayoutDashboard, Users, UserCog, BookOpen, ClipboardList,
  FileText, Mail, BarChart3, Settings, Search, GraduationCap
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

/* ------- Utiles ------- */
const L: Record<DayCode, string> = { MON:'Lun', TUE:'Mar', WED:'Mié', THU:'Jue', FRI:'Vie', SAT:'Sáb' };

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
    // navega pasando la query — la página autocargará resultados
    nav(`/coordinator/students?q=${encodeURIComponent(q)}`);
  };

  const navItems = useMemo(() => {
    const items: { to:string; label:string; icon:any; show:boolean }[] = [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
      { to: '/coordinator/courses', label: 'Cursos', icon: BookOpen, show: me?.role === 'coordinator' || me?.role === 'admin' },
      // 🔻 quitamos "Estudiantes" del sidebar como pediste
      // { to: '/coordinator/students', label: 'Estudiantes', icon: Users, show: me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/coordinator/users', label: 'Personas', icon: Users, show: me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/teacher/courses', label: 'Mis cursos', icon: ClipboardList, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      /* ➕ NUEVO: alumnos del docente */
      { to: '/teacher/students', label: 'Alumnos', icon: Users, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      /* ➕ NUEVO: comunicaciones visible para teacher/coord/admin */
      { to: '/communications', label: 'Comunicaciones', icon: Mail, show: me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin' },
      /* ➕ NUEVO: Casos (coord/admin) */
      { to: '/staff/cases', label: 'Casos', icon: ClipboardList, show: me?.role === 'coordinator' || me?.role === 'admin' },
      { to: '/me', label: 'Mi perfil', icon: UserCog, show: !!me },
      /* ➕ NUEVO: comunicaciones para alumnos en el sidebar */
      { to: '/student/communications', label: 'Comunicaciones', icon: Mail, show: me?.role === 'student' },
      { to: '/student/partials', label: 'Informes parciales', icon: FileText, show: me?.role === 'student' },
      { to: '/student/finals', label: 'Boletín', icon: BarChart3, show: me?.role === 'student' },
      { to: '/student/british', label: 'Británico', icon: GraduationCap, show: me?.role === 'student' }, // NUEVO
      { to: '/student/practice', label: 'Práctica', icon: Settings, show: me?.role === 'student' },
    ];
    return items.filter(i => i.show);
  }, [me]);

  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
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
            <button className="btn btn-secondary !px-3 !py-2" aria-label="Notificaciones"><Bell size={18}/></button>
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
                  className={'flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-50 ' + (active ? 'bg-neutral-50 font-medium' : '')}
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
              {(me.role === 'teacher' || me.role === 'coordinator' || me.role === 'admin') && <Link className="btn btn-secondary" to="/teacher/courses">Mis cursos</Link>}
              {/* ➕ NUEVO: acceso rápido Alumnos (docente) */}
              {(me.role === 'teacher' || me.role === 'coordinator' || me.role === 'admin') && <Link className="btn btn-secondary" to="/teacher/students">Alumnos</Link>}
              {(me.role === 'teacher' || me.role === 'coordinator' || me.role === 'admin') && <Link className="btn btn-secondary" to="/communications">Comunicaciones</Link>}
              {me && <Link className="btn btn-secondary" to="/me">Mi perfil</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/communications">Comunicaciones</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/partials">Informes parciales</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/finals">Boletín</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/british">Británico</Link>}
              {me?.role === 'student' && <Link className="btn btn-secondary" to="/student/practice">Práctica</Link>}
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
                      : 'Sin horarios'}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('profe@inst.test');
  const [password, setPassword] = useState('profe123');
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="card p-4">
        <h1 className="font-heading text-xl mb-2">Login</h1>
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
          <small className="text-neutral-700">Usuarios seed: admin/coord/profe/alumno @inst.test con clave *123.</small>
        </div>
      </div>
    </div>
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
          {/* Alias operativos */}
          <Route path="/coordinator/course/:id/attendance" element={<AttendancePage />} />
          <Route path="/coordinator/course/:id/partials" element={<TeacherCoursePartials />} />
          <Route path="/coordinator/course/:id/boletin" element={<TeacherCourseReport />} />
          <Route path="/coordinator/course/:id/report" element={<TeacherCourseReport />} />
          <Route path="/coordinator/course/:id/topics" element={<CourseTopicsPage />} />
          <Route path="/coordinator/course/:id/materials" element={<CourseMaterialsPage />} />
          {/* ➕ NUEVO: Británico (edición) */}
          <Route path="/coordinator/course/:id/british" element={<CoordinatorBritishCourse mode="edit" />} />

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

          {/* Imprimible A4 específico */}
          <Route path="/print/final/:courseId/:studentId" element={<PrintFinalReport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
