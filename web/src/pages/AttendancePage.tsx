// web/src/pages/AttendancePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type RosterItem } from '../lib/api';

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const DAY_LABEL: Record<string, string> = {
  MON: 'Lun',
  TUE: 'Mar',
  WED: 'Mié',
  THU: 'Jue',
  FRI: 'Vie',
  SAT: 'Sáb',
};

type RowEdit = {
  studentId: string;
  status: 'P' | 'A' | 'T' | 'J' | '';
};

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();

  const [date, setDate] = useState(todayStr());
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [editRows, setEditRows] = useState<Record<string, RowEdit>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [scheduleText, setScheduleText] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [grid, setGrid] = useState<{ dates: string[]; rows: any[] } | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;

      const r = await api.courses.roster(id);
      setRoster(r.roster);

      const obj: Record<string, RowEdit> = {};
      r.roster.forEach(it => {
        obj[it.student._id] = {
          studentId: it.student._id,
          status: '',
        };
      });

      setEditRows(obj);

      await refreshGrid();

      try {
        const s = await api.courses.schedule.get(id);
        const rows = s.schedule ?? [];

        setScheduleText(
          rows.length
            ? rows.map((x: any) => `${DAY_LABEL[x.day]} ${x.start}-${x.end}`).join(' · ')
            : 'Sin horarios'
        );
      } catch {
        setScheduleText('Sin horarios');
      }
    })();
  }, [id]);

  async function refreshGrid() {
    if (!id) return;

    const r = await api.attendance.grid(id, { from, to });
    setGrid(r);
  }

  const filtered = useMemo(() => roster, [roster]);

  async function saveAll() {
    if (!id) return;

    setSaving(true);

    for (const st of Object.values(editRows)) {
      if (!st.status) continue;

      await api.attendance.upsert({
        courseId: id,
        date,
        studentId: st.studentId,
        status: st.status,
      });
    }

    setMsg('💾 Lista guardada');
    await refreshGrid();

    setSaving(false);
    setTimeout(() => setMsg(null), 2000);
  }

  function setAll(status: 'P' | 'A' | 'T' | 'J') {
    const obj: Record<string, RowEdit> = {};

    roster.forEach(it => {
      obj[it.student._id] = {
        studentId: it.student._id,
        status,
      };
    });

    setEditRows(obj);
  }

  return (
    <div style={page}>
      {/* HEADER HERO */}
      <div style={heroWrap}>
        <div style={heroInner}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={badge}>📚 Gestión de asistencia</div>

            <h1 style={heroTitle}>📋 Tomar asistencia</h1>

            <p style={heroText}>
              Cargá la asistencia del día, marcá todos rápidamente y consultá el histórico del curso.
            </p>

            <div style={heroMetaWrap}>
              <span style={scheduleBadge}>
                🕒 {scheduleText}
              </span>

              {msg && (
                <span style={successBadge}>
                  {msg}
                </span>
              )}
            </div>
          </div>

          <div style={heroStats}>
            <div style={statCard}>
              <div style={statLabel}>Alumnos</div>
              <div style={statValue}>{roster.length}</div>
            </div>

            <div style={statCard}>
              <div style={statLabel}>Fecha</div>
              <div style={statValueSmall}>{fmtFullDate(date)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLES */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>⚙️ Controles rápidos</h2>
            <p style={sectionDesc}>
              Elegí la fecha, marcá todos si querés y guardá la lista.
            </p>
          </div>
        </div>

        <div style={controlsWrap}>
          <div style={inputGroup}>
            <label style={label}>Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={label}>Marcar a todos</label>
            <div style={quickBtnsWrap}>
              <button onClick={() => setAll('P')} style={{ ...quickBtn, ...presentBtn }}>
                ✅ Todos P
              </button>
              <button onClick={() => setAll('A')} style={{ ...quickBtn, ...absentBtn }}>
                ❌ Todos A
              </button>
              <button onClick={() => setAll('T')} style={{ ...quickBtn, ...lateBtn }}>
                ⏰ Todos T
              </button>
              <button onClick={() => setAll('J')} style={{ ...quickBtn, ...justBtn }}>
                📝 Todos J
              </button>
            </div>
          </div>

          <div style={saveWrap}>
            <button
              onClick={saveAll}
              disabled={saving}
              style={{
                ...saveBtn,
                opacity: saving ? 0.75 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '⏳ GUARDANDO...' : '💾 GUARDAR LISTA'}
            </button>
          </div>
        </div>
      </div>

      {/* TABLA EDITOR */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>👩‍🎓 Lista del curso</h2>
            <p style={sectionDesc}>
              Marcá la asistencia individual de cada alumno.
            </p>
          </div>
        </div>

        <div style={tableOuter}>
          <table style={mainTable}>
            <thead>
              <tr>
                <th style={thLeftMain}>Alumno</th>
                <th style={statusThPresent}>P</th>
                <th style={statusThAbsent}>A</th>
                <th style={statusThLate}>T</th>
                <th style={statusThJust}>J</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(item => {
                const st = editRows[item.student._id]?.status || '';

                return (
                  <tr key={item.student._id} style={bodyRow}>
                    <td style={studentNameTd}>{item.student.name}</td>

                    {(['P', 'A', 'T', 'J'] as const).map(s => (
                      <td key={s} style={radioTd}>
                        <label style={radioLabel}>
                          <input
                            type="radio"
                            checked={st === s}
                            onChange={() =>
                              setEditRows(prev => ({
                                ...prev,
                                [item.student._id]: {
                                  studentId: item.student._id,
                                  status: s,
                                },
                              }))
                            }
                            style={{ transform: 'scale(1.18)', accentColor: radioColor(s) }}
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* HISTORICO */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>📊 Histórico de listas</h2>
            <p style={sectionDesc}>
              Filtrá por fechas y revisá la asistencia acumulada.
            </p>
          </div>
        </div>

        <div style={filtersBar}>
          <div style={inputGroup}>
            <label style={label}>Desde</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={input}
            />
          </div>

          <div style={inputGroup}>
            <label style={label}>Hasta</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              style={input}
            />
          </div>

          <div style={saveWrap}>
            <button onClick={refreshGrid} style={applyBtn}>
              Aplicar
            </button>
          </div>
        </div>

        <div style={historyWrap}>
          {!grid || grid.dates.length === 0 ? (
            <div style={emptyState}>
              <div style={emptyIcon}>🗂️</div>
              <div style={emptyTitle}>No hay registros aún</div>
              <div style={emptyText}>
                Cuando guardes asistencias, van a aparecer acá.
              </div>
            </div>
          ) : (
            <div style={tableOuter}>
              <table style={{ ...mainTable, minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={thSmall}>#</th>
                    <th style={thLeftMain}>Apellido y nombre</th>
                    {grid.dates.map(d => (
                      <th key={d} style={thSmall}>
                        {fmtDate(d)}
                      </th>
                    ))}
                    <th style={thSmall}>P</th>
                    <th style={thSmall}>A</th>
                    <th style={thSmall}>J</th>
                    <th style={thSmall}>T</th>
                    <th style={thSmall}>Total</th>
                    <th style={thSmall}>%</th>
                  </tr>
                </thead>

                <tbody>
                  {grid.rows.map((r, idx) => (
                    <tr key={r.student._id} style={bodyRow}>
                      <td style={tdCenter}>{idx + 1}</td>
                      <td style={studentNameTd}>{r.student.name}</td>

                      {grid.dates.map(d => (
                        <td key={d} style={tdCell(getColor(r.statusByDate[d]))}>
                          {r.statusByDate[d] ?? ''}
                        </td>
                      ))}

                      <td style={tdCenter}>{r.resume.P}</td>
                      <td style={tdCenter}>{r.resume.A}</td>
                      <td style={tdCenter}>{r.resume.J}</td>
                      <td style={tdCenter}>{r.resume.T}</td>
                      <td style={tdCenter}>{r.resume.total}</td>
                      <td style={percentTd}>
                        <b>{r.resume.percent}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// helpers
function fmtDate(s: string) {
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
}

function fmtFullDate(s: string) {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function getColor(st?: string | null) {
  if (st === 'P') return { background: '#dcfce7', color: '#166534' };
  if (st === 'A') return { background: '#fee2e2', color: '#991b1b' };
  if (st === 'T') return { background: '#fef3c7', color: '#92400e' };
  if (st === 'J') return { background: '#cffafe', color: '#155e75' };
  return {};
}

function radioColor(st: 'P' | 'A' | 'T' | 'J') {
  if (st === 'P') return '#16a34a';
  if (st === 'A') return '#dc2626';
  if (st === 'T') return '#d97706';
  return '#0891b2';
}

// estilos
const page = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: 16,
};

const heroWrap = {
  marginBottom: 18,
  borderRadius: 28,
  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 45%, #ec4899 100%)',
  padding: 2,
  boxShadow: '0 12px 35px rgba(124, 58, 237, 0.22)',
};

const heroInner = {
  borderRadius: 26,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,245,255,0.98) 100%)',
  padding: 22,
  display: 'flex',
  gap: 18,
  flexWrap: 'wrap' as const,
  alignItems: 'stretch',
  justifyContent: 'space-between',
};

const badge = {
  display: 'inline-block',
  padding: '6px 12px',
  borderRadius: 999,
  background: '#f3e8ff',
  color: '#6b21a8',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.4,
  marginBottom: 10,
  textTransform: 'uppercase' as const,
};

const heroTitle = {
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
  color: '#1f1534',
  lineHeight: 1.1,
};

const heroText = {
  margin: '10px 0 0 0',
  color: '#5b496f',
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 760,
};

const heroMetaWrap = {
  marginTop: 14,
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap' as const,
  alignItems: 'center',
};

const scheduleBadge = {
  fontSize: 12,
  background: '#ede9fe',
  border: '1px solid #c4b5fd',
  color: '#5b21b6',
  padding: '7px 12px',
  borderRadius: 999,
  fontWeight: 700,
};

const successBadge = {
  fontSize: 12,
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
  padding: '7px 12px',
  borderRadius: 999,
  fontWeight: 800,
};

const heroStats = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap' as const,
  alignItems: 'stretch',
};

const statCard = {
  minWidth: 130,
  borderRadius: 20,
  background: '#ffffff',
  border: '1px solid #eadcff',
  padding: '16px 18px',
  boxShadow: '0 6px 18px rgba(0,0,0,0.05)',
};

const statLabel = {
  fontSize: 12,
  fontWeight: 800,
  color: '#7c3aed',
  textTransform: 'uppercase' as const,
  marginBottom: 6,
};

const statValue = {
  fontSize: 30,
  fontWeight: 900,
  color: '#1f1534',
  lineHeight: 1,
};

const statValueSmall = {
  fontSize: 17,
  fontWeight: 800,
  color: '#1f1534',
  lineHeight: 1.2,
};

const sectionCard = {
  borderRadius: 24,
  border: '1px solid #eadcff',
  background: '#ffffff',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
  marginBottom: 16,
  overflow: 'hidden' as const,
};

const sectionHeader = {
  padding: '18px 18px 8px 18px',
};

const sectionTitle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: '#1f1534',
};

const sectionDesc = {
  margin: '6px 0 0 0',
  color: '#6b7280',
  fontSize: 14,
};

const controlsWrap = {
  padding: 18,
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap' as const,
  alignItems: 'end',
};

const filtersBar = {
  padding: 18,
  display: 'flex',
  gap: 14,
  flexWrap: 'wrap' as const,
  alignItems: 'end',
};

const inputGroup = {
  minWidth: 180,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
};

const label = {
  fontSize: 13,
  fontWeight: 800,
  color: '#4b5563',
};

const input = {
  height: 42,
  borderRadius: 14,
  border: '1px solid #d8b4fe',
  padding: '0 12px',
  background: '#fcfbff',
  color: '#111827',
  fontWeight: 600,
  outline: 'none',
};

const quickBtnsWrap = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap' as const,
};

const quickBtn = {
  padding: '10px 14px',
  borderRadius: 999,
  border: 'none',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 13,
};

const presentBtn = {
  background: '#dcfce7',
  color: '#166534',
};

const absentBtn = {
  background: '#fee2e2',
  color: '#991b1b',
};

const lateBtn = {
  background: '#fef3c7',
  color: '#92400e',
};

const justBtn = {
  background: '#cffafe',
  color: '#155e75',
};

const saveWrap = {
  display: 'flex',
  alignItems: 'end',
};

const saveBtn = {
  height: 44,
  padding: '0 20px',
  borderRadius: 999,
  border: 'none',
  background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
  color: '#fff',
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 0.4,
  boxShadow: '0 10px 22px rgba(124, 58, 237, 0.25)',
};

const applyBtn = {
  height: 44,
  padding: '0 18px',
  borderRadius: 999,
  border: 'none',
  background: '#1f2937',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};

const tableOuter = {
  overflowX: 'auto' as const,
  padding: '0 18px 18px 18px',
};

const historyWrap = {
  paddingBottom: 6,
};

const mainTable = {
  width: '100%',
  borderCollapse: 'separate' as const,
  borderSpacing: 0,
  background: '#fff',
};

const thBase = {
  padding: 12,
  fontSize: 13,
  fontWeight: 900,
  borderBottom: '1px solid #e9d5ff',
  borderTop: '1px solid #f3e8ff',
  whiteSpace: 'nowrap' as const,
};

const thLeftMain = {
  ...thBase,
  textAlign: 'left' as const,
  background: '#faf5ff',
  color: '#4c1d95',
  minWidth: 240,
};

const thSmall = {
  ...thBase,
  textAlign: 'center' as const,
  background: '#faf5ff',
  color: '#4c1d95',
};

const statusThPresent = {
  ...thBase,
  textAlign: 'center' as const,
  background: '#dcfce7',
  color: '#166534',
  width: 70,
};

const statusThAbsent = {
  ...thBase,
  textAlign: 'center' as const,
  background: '#fee2e2',
  color: '#991b1b',
  width: 70,
};

const statusThLate = {
  ...thBase,
  textAlign: 'center' as const,
  background: '#fef3c7',
  color: '#92400e',
  width: 70,
};

const statusThJust = {
  ...thBase,
  textAlign: 'center' as const,
  background: '#cffafe',
  color: '#155e75',
  width: 70,
};

const bodyRow = {
  borderTop: '1px solid #f3f4f6',
};

const studentNameTd = {
  padding: 12,
  borderBottom: '1px solid #f1f5f9',
  color: '#111827',
  fontWeight: 700,
  textAlign: 'left' as const,
  background: '#fff',
};

const radioTd = {
  padding: 12,
  textAlign: 'center' as const,
  borderBottom: '1px solid #f1f5f9',
  background: '#fff',
};

const radioLabel = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 999,
  background: '#fafafa',
};

const tdCenter = {
  textAlign: 'center' as const,
  padding: 10,
  borderBottom: '1px solid #f1f5f9',
  fontWeight: 700,
};

const percentTd = {
  textAlign: 'center' as const,
  padding: 10,
  borderBottom: '1px solid #f1f5f9',
  fontWeight: 800,
  color: '#4c1d95',
};

const tdCell = (extra: any) => ({
  padding: 8,
  textAlign: 'center' as const,
  fontWeight: 800,
  borderBottom: '1px solid #f1f5f9',
  ...extra,
});

const emptyState = {
  margin: '0 18px 18px 18px',
  borderRadius: 20,
  border: '1px dashed #d8b4fe',
  background: '#faf5ff',
  padding: 30,
  textAlign: 'center' as const,
};

const emptyIcon = {
  fontSize: 34,
  marginBottom: 10,
};

const emptyTitle = {
  fontSize: 18,
  fontWeight: 900,
  color: '#4c1d95',
};

const emptyText = {
  marginTop: 6,
  fontSize: 14,
  color: '#6b7280',
};
