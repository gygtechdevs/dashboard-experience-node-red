"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BookOpenIcon,
  CircleHelpIcon,
  GraduationCapIcon,
  LogOutIcon,
  MenuIcon,
  PlugIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  href?: string;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { label: "Analítica", icon: BarChart3Icon, href: "/analytics" },
  {
    label: "Conocimiento",
    icon: BookOpenIcon,
    children: [{ label: "Personalizado", href: "/knowledge/custom" }, { label: "Autogenerado" }],
  },
  { label: "Integraciones", icon: PlugIcon },
  {
    label: "Entrenamiento",
    icon: GraduationCapIcon,
    children: [{ label: "Cola de revisión", href: "/training/review" }],
  },
  { label: "Configuración", icon: SettingsIcon },
  { label: "Ayuda", icon: CircleHelpIcon },
];

interface AppSidebarProps {
  email: string;
  logout: () => Promise<void>;
}

export function AppSidebar({ email, logout }: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <span className="font-semibold">Node-RED</span>
        <button
          type="button"
          aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={open}
          aria-controls="primary-navigation"
          className="rounded-md p-1.5 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <XIcon className="size-5" aria-hidden="true" /> : <MenuIcon className="size-5" aria-hidden="true" />}
        </button>
      </header>

      <aside
        id="primary-navigation"
        className={cn(
          "w-full flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0",
          open ? "flex" : "hidden",
        )}
      >
        <div className="hidden px-5 py-5 text-lg font-semibold md:block">Node-RED</div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="grid gap-1">
            {NAV.map((item) => (
              <li key={item.label}>
                <NavEntry item={item} pathname={pathname} onNavigate={() => setOpen(false)} />
                {item.children ? (
                  <ul className="mt-1 ml-7 grid gap-1 border-l border-sidebar-border pl-2">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <NavEntry item={child} pathname={pathname} onNavigate={() => setOpen(false)} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <p className="truncate px-2 pb-2 text-xs text-sidebar-foreground/70" title={email}>
            {email}
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
            >
              <LogOutIcon className="size-4" aria-hidden="true" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

/** The entry itself or any page below it; `/training/review-x` is not below `/training/review`. */
function isActive(pathname: string, href: string): boolean {
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return current === href || current.startsWith(`${href}/`);
}

function NavEntry({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const base = "flex items-center gap-2 rounded-md px-2 py-2 text-sm";

  if (!item.href) {
    // Parent group headings and not-yet-built pages are not interactive.
    const isGroup = item.children !== undefined;
    return (
      <span
        className={cn(base, isGroup ? "text-sidebar-foreground" : "cursor-not-allowed text-sidebar-foreground/50")}
        aria-disabled={isGroup ? undefined : true}
      >
        {Icon ? <Icon className="size-4" aria-hidden={true} /> : null}
        {item.label}
        {!isGroup ? <SoonBadge /> : null}
      </span>
    );
  }

  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        base,
        "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
    >
      {Icon ? <Icon className="size-4" aria-hidden={true} /> : null}
      {item.label}
    </Link>
  );
}

function SoonBadge() {
  return (
    <span className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Próximamente</span>
  );
}
