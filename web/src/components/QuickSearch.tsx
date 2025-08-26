import { useEffect, useMemo, useState } from "react";

export type QuickSearchFilters = {
  sede?: "Derqui" | "José C. Paz" | "";
  turno?: "Mañana" | "Tarde" | "Noche" | "";
  estado?: "Activo" | "Inactivo" | "";
};

export default function QuickSearch({ onChange }:{
  onChange: (q: string, f: QuickSearchFilters)=>void
}) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<QuickSearchFilters>({ sede:"", turno:"", estado:"" });
  const debounced = useDebounce(q, 300);

  useEffect(()=>{ onChange(debounced, f); }, [debounced, f]);

  return (
    <div className="card p-3 md:p-4">
      <div className="flex flex-col md:flex-row gap-2">
        <input className="input" placeholder="Nombre / DNI / Curso" value={q} onChange={e=>setQ(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          <Select value={f.sede} onChange={v=>setF({...f, sede:v})} options={["","Derqui","José C. Paz"]} label="Sede"/>
          <Select value={f.turno} onChange={v=>setF({...f, turno:v})} options={["","Mañana","Tarde","Noche"]} label="Turno"/>
          <Select value={f.estado} onChange={v=>setF({...f, estado:v})} options={["","Activo","Inactivo"]} label="Estado"/>
        </div>
      </div>
    </div>
  );
}

function Select({ value, onChange, options, label }:{
  value:string; onChange:(v:any)=>void; options:string[]; label:string;
}) {
  return (
    <label className="text-sm">
      <span className="sr-only">{label}</span>
      <select className="input" value={value} onChange={e=>onChange(e.target.value)}>
        {options.map(o=> <option key={o} value={o}>{o || label}</option>)}
      </select>
    </label>
  );
}

function useDebounce<T>(value:T, delay:number){ 
  const [v,setV]=useState(value);
  useEffect(()=>{ const id=setTimeout(()=>setV(value),delay); return ()=>clearTimeout(id); },[value,delay]);
  return v;
}
