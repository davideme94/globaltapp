import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export default function ActionEliminarCurso({
  course,
  onDone,
}: {
  course: { _id: string; name: string; year: number };
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (loading) return;
    const ok = window.confirm(
      `Vas a eliminar el curso:\n\n${course.name} (${course.year})\n\nSe borrarán inscripciones y datos asociados.\n¿Continuar?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await api.courses.delete(course._id);
      toast.success('Curso eliminado');
      onDone(); // recargar listado
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar el curso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="text-danger hover:underline disabled:opacity-60 ml-2"
      onClick={handleDelete}
      disabled={loading}
      title="Eliminar curso (borra inscripciones y datos relacionados)"
    >
      {loading ? 'Eliminando…' : 'Eliminar'}
    </button>
  );
}
