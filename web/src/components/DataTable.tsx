import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { clsx } from "clsx";

export type Column<T> = { key: keyof T; header: string };
export default function DataTable<T extends Record<string, any>>({
  data, columns, onView, onEdit, onMessage
}:{ data:T[]; columns:Column<T>[]; onView?:(r:T)=>void; onEdit?:(r:T)=>void; onMessage?:(r:T)=>void; }) {
  const [sortKey, setSortKey] = useState<keyof T|''>('');
  const [dir, setDir] = useState<1|-1>(1);

  const sorted = useMemo(()=>{
    if(!sortKey) return data;
    return [...data].sort((a,b)=>{
      const av=a[sortKey], bv=b[sortKey];
      return (av>bv?1:av<bv?-1:0)*dir;
    });
  },[data, sortKey, dir]);

  const toggleSort = (k: keyof T)=> {
    if (sortKey === k) setDir(d=>d*-1);
    else { setSortKey(k); setDir(1); }
  };

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-sm text-neutral-700">
            {columns.map(c=>(
              <th key={String(c.key)} className="px-3 py-2 border-b border-neutral-200 cursor-pointer select-none"
                  onClick={()=>toggleSort(c.key)}>
                <div className="inline-flex items-center gap-1">
                  {c.header}
                  {sortKey===c.key ? (dir===1 ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : null}
                </div>
              </th>
            ))}
            <th className="px-3 py-2 border-b border-neutral-200">Acciones</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {sorted.map((row, i)=>(
            <tr key={i} className={clsx("hover:bg-neutral-50", i%2===1 && "bg-neutral-50/40")}>
              {columns.map(c=>(
                <td key={String(c.key)} className="px-3 py-2 whitespace-nowrap">{String(row[c.key] ?? '')}</td>
              ))}
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <button className="btn btn-secondary !px-2 !py-1" onClick={()=>onView?.(row)}>Ver</button>
                  <button className="btn btn-secondary !px-2 !py-1" onClick={()=>onEdit?.(row)}>Editar</button>
                  <button className="btn btn-primary !px-2 !py-1" onClick={()=>onMessage?.(row)}>
                    <MoreHorizontal size={16}/>
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {sorted.length===0 && (
            <tr><td colSpan={columns.length+1} className="px-3 py-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-xl" style={{background:'var(--grad-brand)'}}/>
                <p className="text-neutral-700">Sin resultados</p>
                <button className="btn btn-primary">Crear nuevo</button>
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
