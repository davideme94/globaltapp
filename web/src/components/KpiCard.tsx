import { ReactNode } from "react";

export function KpiCard({ title, value, icon }: { title: string; value: string; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-neutral-700">{title}</h3>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-heading">{value}</div>
    </div>
  );
}
