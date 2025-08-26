import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Course } from '../lib/api';

type Campus = 'DERQUI' | 'JOSE_C_PAZ' | 'ALL';
type Found = {
  student: { _id: string; name: string; email: string };
  courses: { _id: string; name: string; campus: 'DERQUI'|'JOSE_C_PAZ'; year: number }[];
};

export default function CoordinatorStudentSearch() {
  const thisYear = new Date().getFullYear();

  const [q, setQ] = useState('');
  const [year, setYear] = useState(thisYear);
  const [campus, setCampus] = useState<Campus>('ALL');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Found[]>([]);
  const [err, setErr] = useState<string|null>(null);

  const trimmedQ = useMemo(() => q.trim().toLowerCase(), [q]);

  async function runSearch() {
    setErr(null);
    setRows([]);
    setLoading(true);
    try {
      // 1) Cursos del año (opcionalmente por sede)
      const list = await api.courses.list({
        year,
        campus: campus === 'ALL' ? undefined : campus as any
      });

      // 2) Construir índice: studentId -> { student, courses[] }
      const map = new Map<string, Found>();

      // Traemos rosters en serie simple (cantidad de cursos es chica)
      for (const c of list.courses) {
        const r = await api.courses.roster(c._id);
        for (const it of r.roster) {
          const name = it.student.name?.toLowerCase?.() ?? '';
          const email = it.student.email?.toLowerCase?.() ?? '';
          // Si hay búsqueda, filtrar acá mismo
          if (trimmedQ && !(name.includes(trimmedQ) || email.includes(trimmedQ))) continue;

          const key = it.student._id;
          if (!map.has(key)) {
            map.set(key, { student: it.student, courses: [] });
          }
          map.get(key)!.courses.push({
            _id: c._id, name: c.name, campus: c.campus, year: c.year
          });
        }
      }

      // 3) Ordenar por nombre
      const arr = Array.from(map.values())
        .sort((a,b) => a.student.name.localeCompare(b.student.name));

      setRows(arr);
    } catch (e:any) {
      setErr(e.message || 'Error al buscar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Búsqueda vacía: no ejecutar automáticamente
  }, []);

  return (
    <div style={{ padding:16, maxWidth: 1100 }}>
      <h1>Buscar alumno</h1>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        <input
          placeholder="Nombre o email del alumno"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <select value={year} onChange={e=>setYear(parseInt(e.target.value || `${thisYear}`))}>
          {Array.from({length:5}).map((_,i)=> {
            const y = thisYear - (2 - i); // muestra 3 años alrededor
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <select value={campus} onChange={e=>setCampus(e.target.value as Campus)}>
          <option value="ALL">Todas las sedes</option>
          <option value="DERQUI">DERQUI</option>
          <option value="JOSE_C_PAZ">JOSE C. PAZ</option>
        </select>
        <button onClick={runSearch} disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
        {err && <span style={{ color:'red' }}>{err}</span>}
      </div>

      {rows.length === 0 ? (
        <p style={{ color:'#64748b' }}>
          {loading ? 'Cargando…' : 'Sin resultados. Probá escribir al menos 3 letras del nombre o email y presioná “Buscar”.'}
        </p>
      ) : (
        <table style={{ borderCollapse:'collapse', width:'100%' }}>
          <thead>
            <tr>
              <th style={th}>Alumno</th>
              <th style={th}>Email</th>
              <th style={th}>Sedes</th>
              <th style={th}>Cursos ({year})</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              // sedes únicas según cursos
              const sedes = Array.from(new Set(r.courses.map(c=>c.campus))).join(' · ');
              return (
                <tr key={r.student._id}>
                  <td style={td}><b>{r.student.name}</b></td>
                  <td style={td}>{r.student.email}</td>
                  <td style={td}>{sedes || '—'}</td>
                  <td style={td}>
                    {r.courses.length === 0
                      ? <span style={{ color:'#64748b' }}>—</span>
                      : r.courses
                          .sort((a,b)=>a.name.localeCompare(b.name))
                          .map(c => (
                            <div key={c._id}>
                              {c.name} — <i>{c.campus}</i>
                            </div>
                          ))}
                  </td>
                  <td style={td}>
                    {r.courses.map(c => (
                      <div key={c._id} style={{ marginBottom:4 }}>
                        <Link to={`/print/final/${c._id}/${r.student._id}`}>Boletín</Link>
                        {' · '}
                        <Link to={`/teacher/message/${c._id}/${r.student._id}`}>Comunicaciones</Link>
                      </div>
                    ))}
                    {r.courses.length === 0 && <span style={{ color:'#64748b' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { borderBottom:'1px solid #e2e8f0', textAlign:'left', padding:6, background:'#f8fafc' };
const td: React.CSSProperties = { borderBottom:'1px solid #f1f5f9', textAlign:'left', padding:6, verticalAlign:'top' };
