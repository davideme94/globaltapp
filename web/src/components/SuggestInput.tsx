import { useEffect, useRef, useState } from 'react';

export type Option = { value: string; label: string };

export default function SuggestInput({
  value, onChange, onPick, placeholder, options, loading,
}:{
  value: string;
  onChange: (v: string) => void;
  onPick: (opt: Option) => void;
  placeholder?: string;
  options: Option[];
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className="input w-full"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto bg-white border rounded shadow">
          {loading && <div className="px-3 py-2 text-sm text-neutral-500">Cargando…</div>}
          {!loading && options.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral-500">Sin resultados</div>
          )}
          {!loading && options.map(o => (
            <button
              key={o.value}
              className="block w-full text-left px-3 py-2 hover:bg-neutral-100"
              onClick={() => { onPick(o); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
