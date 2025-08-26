import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import MyCoursesCard from '../components/MyCoursesCard';
import StudentCoursesDebugCard from '../components/StudentCoursesDebugCard';

export default function Dashboard() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 60_000 });

  if (me.isLoading) return <div className="p-4">Cargando…</div>;
  if (me.error || !me.data) return <div className="p-4 text-red-600">No se pudo cargar tu perfil.</div>;

  const { user } = me.data;
  const campusLabel = user.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz';

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border bg-white p-4">
        <h1 className="text-xl font-semibold">Inicio — DEBUG DASHBOARD</h1>
        <p className="mt-1">
          Hola, <b>{user.name}</b> — rol: <b>{user.role}</b> — sede:{' '}
          <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-800">{campusLabel}</span>
        </p>
      </div>

      {/* SIEMPRE renderiza los cursos del alumno (aunque el rol no sea 'student' lo verás durante la prueba) */}
      <MyCoursesCard />

      {/* JSON crudo para validar que el navegador recibe lo mismo que Thunder/curl */}
      <StudentCoursesDebugCard />
    </div>
  );
}
