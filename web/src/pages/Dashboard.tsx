import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import MyCoursesCard from '../components/MyCoursesCard';
import StudentCoursesDebugCard from '../components/StudentCoursesDebugCard';
import StudentAttendanceCard from '../components/StudentAttendanceCard';

export default function Dashboard() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    staleTime: 60_000,
  });

  if (me.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-100">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (me.error || !me.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h1 className="text-xl font-black">
            No se pudo cargar tu perfil
          </h1>
          <p className="mt-1 text-sm font-medium">
            Intentá actualizar la página o volver a iniciar sesión.
          </p>
        </div>
      </div>
    );
  }

  const { user } = me.data;
  const campusLabel = user.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz';

  const roleLabel =
    user.role === 'student'
      ? 'Alumno'
      : user.role === 'teacher'
        ? 'Docente'
        : user.role === 'coordinator'
          ? 'Coordinación'
          : 'Administración';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                👋 Panel principal
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Hola, {user.name}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Bienvenido/a a tu espacio de cursada. Desde acá podés consultar tus cursos,
                asistencia y accesos disponibles.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Rol
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {roleLabel}
                </p>
              </div>

              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-sky-500">
                  Sede
                </p>
                <p className="mt-1 text-sm font-black text-sky-800">
                  {campusLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENIDO PRINCIPAL */}
      <section className="grid gap-6">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-neutral-950">
                Mis cursos
              </h2>
              <p className="text-sm text-neutral-500">
                Cursos en los que estás inscripto/a actualmente.
              </p>
            </div>

            <span className="w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-700">
              Cursos activos
            </span>
          </div>

          <MyCoursesCard />
        </div>

        <div className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-neutral-950">
                Mi asistencia
              </h2>
              <p className="text-sm text-neutral-500">
                Resumen de asistencias, ausentes, justificadas y porcentaje general.
              </p>
            </div>

            <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
              Seguimiento
            </span>
          </div>

          <StudentAttendanceCard />
        </div>

        <div className="rounded-[2rem] border border-dashed border-neutral-200 bg-neutral-50 p-4 shadow-sm sm:p-5">
          <details>
            <summary className="cursor-pointer text-sm font-black uppercase tracking-wide text-neutral-600">
              Ver información técnica / debug
            </summary>

            <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4">
              <StudentCoursesDebugCard />
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
