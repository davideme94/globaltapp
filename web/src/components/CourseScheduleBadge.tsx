import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Day = 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT';
const L: Record<Day,string> = { MON:'Lun', TUE:'Mar', WED:'Mié', THU:'Jue', FRI:'Vie', SAT:'Sáb' };

export default function CourseScheduleBadge({ courseId }: { courseId: string }) {
  const [text, setText] = useState<string>('—');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.courses.schedule.get(courseId);
        const s = (r.schedule ?? []) as { day:Day; start:string; end:string }[];
        setText(s.length
          ? s.map(x => `${L[x.day]} ${x.start}-${x.end}`).join(' · ')
          : 'Sin horarios');
      } catch {
        setText('Sin horarios');
      }
    })();
  }, [courseId]);

  return (
    <span style={{
      fontSize: 12,
      background: '#eef2ff',
      border: '1px solid #c7d2fe',
      color: '#1e293b',
      padding: '2px 6px',
      borderRadius: 9999,
    }}>
      {text}
    </span>
  );
}
