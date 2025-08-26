import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

// ⚠️ Cambiá estas URLs por tu logo e imagen de portada
const LOGO_URL = 'https://dummyimage.com/180x60/ffffff/000&text=Global-T';
const COVER_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Palace_of_Westminster%2C_London_-_Feb_2007.jpg';

// Tipado del detalle que trae todo listo para imprimir
type Detail = Awaited<ReturnType<typeof api.reportcards.detail>>;

export default function PrintFinalReport() {
  const { courseId, studentId } = useParams<{ courseId: string; studentId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.reportcards.detail(courseId!, studentId!);
        setData(d);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [courseId, studentId]);

  const campusInfo = useMemo(() => {
    const campus = data?.course?.campus || 'DERQUI';
    if (campus === 'DERQUI') return { addr: 'Eva Perón 795', city: 'Derqui', phone: '1153875334' };
    return { addr: 'Granaderos A Caballo 4896', city: 'José C. Paz', phone: '1553875273' };
  }, [data]);

  // Promedio simple de los tres trimestres (si hay valores)
  function avg3(a?: number | null, b?: number | null, c?: number | null) {
    const vals = [a, b, c].filter((n): n is number => typeof n === 'number');
    if (!vals.length) return '—';
    return String(Math.round(vals.reduce((x, y) => x + y, 0) / vals.length));
  }

  if (err) return <div style={{ padding: 16, color: 'red' }}>{err}</div>;
  if (!data) return <div style={{ padding: 16 }}>Cargando…</div>;

  const year = data.course.year;
  const alumno = (data.student.name || '').toUpperCase();
  const curso = data.course.name;
  const prof = data.teacher?.name || '';
  const card = data.report; // <<— UNIFICADO (incluye t1, t2, t3 + exámenes/final/condición)

  const t1 = card?.t1;
  const t2 = card?.t2;
  const t3 = card?.t3;

  return (
    <div>
      {/* Estilos de impresión A4 */}
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print { .no-print { display:none } body { background: white; } }
        body { background: #f5f5f5; }
        .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 12px; background: white; box-shadow: 0 0 0.5mm rgba(0,0,0,.2); border: 1px solid #ccc; }
        .pad { padding: 10mm; }
        .cyan { background: #79d8f6; }
        .rightcol { width: 34%; }
        .leftcol { width: 66%; }
        .title { font-weight: 800; font-size: 20pt; }
        .bigYear { font-size: 24pt; font-weight: 800; }
        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th, .tbl td { border: 1px solid #000; padding: 6px; font-size: 11pt; }
        .small { font-size: 9pt; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
      `}</style>

      {/* BOTÓN IMPRIMIR */}
      <div className="no-print" style={{ padding: 12 }}>
        <button onClick={() => window.print()}>🖨️ Imprimir / Guardar PDF</button>
      </div>

      {/* PÁGINA 1 – Portada */}
      <div className="sheet">
        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <div className="leftcol pad">
            <img src={LOGO_URL} alt="Global-T" style={{ height: 48, objectFit: 'contain' }} />
          </div>
          <div className="rightcol cyan" style={{ display:'flex', alignItems:'center', justifyContent:'center', borderLeft:'1px solid #000' }}>
            <div className="bigYear">{year}</div>
          </div>
        </div>

        <div style={{ display: 'flex', minHeight: '200mm' }}>
          <div className="leftcol pad" style={{ borderRight:'1px solid #000' }}>
            <img src={COVER_URL} alt="Cover" style={{ width:'100%', height:'auto', maxHeight:'180mm', objectFit:'cover', border:'1px solid #999' }}/>
          </div>
          <div className="rightcol cyan pad" style={{ display:'flex', alignItems:'center' }}>
            <div className="title">Instituto<br/>Educativo<br/>Global-T</div>
          </div>
        </div>

        <div style={{ display:'flex', borderTop:'1px solid #000' }}>
          <div className="leftcol cyan pad bold small">
            Instituto Educativo Global-T<br/>
            {campusInfo.addr}<br/>
            {campusInfo.city} – Cel: {campusInfo.phone}
          </div>
          <div className="rightcol" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderLeft:'1px solid #000' }}>
            <div className="center cyan bold" style={{ gridColumn:'1 / span 2', padding:'6px 0', borderBottom:'1px solid #000' }}>Ficha de Informe</div>
            <div className="pad small bold" style={{ borderRight:'1px solid #000' }}>
              Alumno: {alumno}
            </div>
            <div className="pad small bold">
              Curso: {curso}
            </div>
          </div>
        </div>
      </div>

      {/* PÁGINA 2 – Tabla (3 trimestres + promedio) */}
      <div className="sheet pad">
        <div className="small bold" style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
          <div>Profesor: {prof}</div>
          <div>Alumno: {alumno}</div>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th></th>
              <th>Primer Trimestre<br/>(Mar/Abr/May)</th>
              <th>Segundo Trimestre<br/>(Jun/Jul/Ago)</th>
              <th>Tercer Trimestre<br/>(Sep/Oct/Nov/Dic)</th>
              <th>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Writing (escrito)', 'writing'],
              ['Speaking (oral)', 'speaking'],
              ['Reading (leer)', 'reading'],
              ['Listening (escuchar)', 'listening']
            ].map(([label, key]) => {
              const k = key as 'writing'|'speaking'|'reading'|'listening';
              const v1 = t1?.[k] ?? '';
              const v2 = t2?.[k] ?? '';
              const v3 = t3?.[k] ?? '';
              const promedio = avg3(
                typeof v1 === 'number' ? v1 : null,
                typeof v2 === 'number' ? v2 : null,
                typeof v3 === 'number' ? v3 : null
              );
              return (
                <tr key={k}>
                  <td className="bold">{label}</td>
                  <td className="center">{v1 as any}</td>
                  <td className="center">{v2 as any}</td>
                  <td className="center">{v3 as any}</td>
                  <td className="center">{promedio}</td>
                </tr>
              );
            })}

            {/* Observaciones por trimestre */}
            <tr>
              <td className="bold">Observaciones</td>
              <td>{t1?.comments || '¡Bienvenido! / Welcome!'}</td>
              <td>{t2?.comments || ''}</td>
              <td>{t3?.comments || ''}</td>
              <td></td>
            </tr>

            {/* Firmas (espacios en blanco) */}
            <tr>
              <td className="bold">Firma del Alumno</td>
              <td></td><td></td><td></td><td></td>
            </tr>
            <tr>
              <td className="bold">Firma del Tutor</td>
              <td></td><td></td><td></td><td></td>
            </tr>

            {/* Exámenes / Finales / Condición */}
            <tr>
              <td className="bold">Exámenes</td>
              <td>
                <div className="small">
                  Oral examen: <b>{card?.examOral ?? '—'}</b><br/>
                  Escrito examen: <b>{card?.examWritten ?? '—'}</b>
                </div>
              </td>
              <td>
                <div className="small">
                  Oral final: <b>{card?.finalOral ?? '—'}</b><br/>
                  Escrito final: <b>{card?.finalWritten ?? '—'}</b>
                </div>
              </td>
              <td>
                <div className="small">
                  Condición:{' '}
                  <b>
                    {({
                      APPROVED: 'Aprobado',
                      FAILED_ORAL: 'Desaprobado (oral)',
                      FAILED_WRITTEN: 'Desaprobado (escrito)',
                      FAILED_BOTH: 'Desaprobado (ambos)',
                      PASSED_INTERNAL: 'Pasó con examen interno',
                      REPEATER: 'Repitente'
                    } as any)[card?.condition || 'APPROVED']}
                  </b>
                </div>
              </td>
              <td></td>
            </tr>

            {/* Comentarios generales del docente (boletín) */}
            {card?.comments ? (
              <tr>
                <td className="bold">Comentarios</td>
                <td colSpan={4}>{card.comments}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
