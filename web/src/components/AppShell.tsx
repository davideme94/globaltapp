import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Menu, LayoutDashboard, Users, UserCog, BookOpen, ClipboardList,
  FileText, Mail, BarChart3, Settings, Bell, Search
} from "lucide-react";
import { clsx } from "clsx";

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Estudiantes", icon: Users, to: "/students" },
  { label: "Docentes", icon: UserCog, to: "/teachers" },
  { label: "Cursos", icon: BookOpen, to: "/courses" },
  { label: "Asistencia", icon: ClipboardList, to: "/attendance" },
  { label: "Boletines", icon: FileText, to: "/report-cards" },
  { label: "Comunicaciones", icon: Mail, to: "/communications" },
  { label: "Reportes", icon: BarChart3, to: "/reports" },
  { label: "Configuración", icon: Settings, to: "/settings" },
];

export default function AppShell() {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-3 md:px-6 h-14 flex items-center gap-3">
          <button aria-label="Abrir menú" className="md:hidden btn btn-secondary !px-2 !py-2"
            onClick={() => setOpen(s => !s)}>
            <Menu size={20}/>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl" style={{background:'var(--grad-brand)'}}/>
            <span className="font-heading font-bold">Global-T</span>
          </div>
          <div className="flex-1 max-w-xl mx-auto hidden md:flex">
            <label className="relative w-full" aria-label="Búsqueda global">
              <Search className="absolute left-3 top-2.5" size={18}/>
              <input className="input pl-9" placeholder="Buscar por Nombre, DNI o Curso…" />
            </label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-secondary !px-3 !py-2 focus-ring" aria-label="Notificaciones"><Bell size={18}/></button>
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold"
                 style={{background:'var(--brand-deep)'}}>DG</div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl w-full grid grid-cols-1 md:grid-cols-[240px,1fr] gap-4 px-3 md:px-6 py-4">
        {/* Sidebar */}
        <aside className={clsx("card h-fit md:sticky md:top-16 p-2 md:p-3", open ? "block" : "hidden md:block")}>
          <nav className="flex flex-col">
            {nav.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-50 focus-ring",
                    isActive && "bg-neutral-100 text-brand-primary"
                  )
                }
              >
                <item.icon size={18}/><span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          <Outlet /> {/* <- acá se renderiza la página (Dashboard, etc.) */}
        </main>
      </div>
    </div>
  );
}
