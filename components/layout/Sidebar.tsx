"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Newspaper,
  Calendar,
  Phone,
  GraduationCap,
  FileText,
  MessageSquare,
  LayoutDashboard,
  Users,
  Stethoscope,
  Brain,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Ticket,
  Clock,
  ShieldCheck,
  BarChart3,
  CalendarDays,
  Settings,
  Package,
  LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { StaffRole } from "@/lib/auth/staff";
import type { MenuItemConfig } from "@/lib/menu/types";
import { NotificacaoDot } from "@/components/news/NotificacaoDot";
import { useMobileSidebar } from "@/components/layout/MobileSidebarContext";
import { CATEGORY_ORDER } from "@/lib/menu/types";

const ICON_MAP: Record<string, LucideIcon> = {
  Newspaper,
  Calendar,
  Phone,
  GraduationCap,
  FileText,
  Brain,
  Ticket,
  Clock,
  CalendarDays,
  Stethoscope,
  ShieldCheck,
  MessageSquare,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
};

const adminItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/pacientes", label: "Pacientes", icon: Stethoscope },
  { href: "/admin/treinamentos", label: "Treinamentos", icon: ClipboardList },
  { href: "/admin/chatbot", label: "Base de Conhecimento", icon: MessageSquare },
  { href: "/admin/chamados", label: "Chamados", icon: Ticket },
  { href: "/admin/inventario", label: "Inventário TI", icon: Package },
  { href: "/admin/ponto", label: "Ponto / RH", icon: BarChart3 },
];

interface SidebarProps {
  role: StaffRole;
  isManager?: boolean;
  menuItems: MenuItemConfig[];
}

export function Sidebar({ role, isManager, menuItems }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen: mobileOpen, close } = useMobileSidebar();
  const isAdmin = ["admin", "ti"].includes(role);
  const canConfig = ["admin", "ti", "marketing"].includes(role);
  const isRH = ["admin", "ti", "rh"].includes(role);
  const canApprove = isManager || isRH;

  // Agrupar itens por categoria na ordem definida
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: menuItems
      .filter((item) => item.category === cat)
      .sort((a, b) => a.order_num - b.order_num),
  })).filter((g) => g.items.length > 0);

  // Itens fora das categorias ordenadas
  const knownCategories = new Set(CATEGORY_ORDER as readonly string[]);
  const extraGroups = Array.from(
    menuItems
      .filter((item) => !knownCategories.has(item.category))
      .reduce((map, item) => {
        if (!map.has(item.category)) map.set(item.category, []);
        map.get(item.category)!.push(item);
        return map;
      }, new Map<string, MenuItemConfig[]>())
      .entries()
  ).map(([category, items]) => ({ category, items }));

  const allGroups = [...grouped, ...extraGroups];

  function NavLink({
    href,
    label,
    icon: Icon,
    showBadge,
  }: {
    href: string;
    label: string;
    icon: LucideIcon;
    showBadge?: boolean;
  }) {
    const isActive =
      href === "/intranet"
        ? pathname === href
        : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        onClick={close}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
          isActive
            ? "bg-white text-[#1e40af] font-medium"
            : "text-blue-100 hover:bg-blue-600 hover:text-white"
        )}
        title={collapsed ? label : undefined}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span>{label}</span>}
        {!collapsed && showBadge && <NotificacaoDot />}
      </Link>
    );
  }

  return (
    <>
      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "flex flex-col bg-[#1e40af] text-white transition-all duration-300",
          // Mobile: overlay fixo
          "fixed inset-y-0 left-0 z-50",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: sempre visível no fluxo normal
          "lg:relative lg:translate-x-0 lg:min-h-screen",
          collapsed ? "w-16" : "w-64"
        )}
      >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-blue-600">
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight">Hospital Evandro</span>
            <span className="font-bold text-sm leading-tight">Ribeiro</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-blue-600 transition-colors ml-auto"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* Início — sempre fixo */}
        <div className="px-2 mb-2">
          <NavLink href="/intranet" label="Início" icon={Home} />
        </div>

        {/* Grupos de categorias */}
        {allGroups.map(({ category, items }) => (
          <div key={category} className="mb-2">
            {!collapsed && (
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-blue-300 uppercase tracking-wider">
                {category}
              </p>
            )}
            {collapsed && <div className="border-t border-blue-600 my-1 mx-2" />}
            <div className="px-2 space-y-0.5">
              {items.map((item) => {
                const Icon = ICON_MAP[item.icon] ?? FileText;
                return (
                  <NavLink
                    key={item.key}
                    href={item.href}
                    label={item.label}
                    icon={Icon}
                    showBadge={item.key === "noticias"}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Aprovações de Ponto (gestores) — sempre em Ponto */}
        {canApprove && (
          <div className="px-2">
            <NavLink
              href="/intranet/ponto/aprovacoes"
              label="Aprovações Ponto"
              icon={ShieldCheck}
            />
          </div>
        )}

        {/* Configurações (ti + marketing + admin) */}
        {canConfig && (
          <div className="mb-2">
            {!collapsed && (
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-blue-300 uppercase tracking-wider">
                Configurações
              </p>
            )}
            {collapsed && <div className="border-t border-blue-600 my-1 mx-2" />}
            <div className="px-2">
              <NavLink
                href="/intranet/configuracoes/menu"
                label="Permissões de Menu"
                icon={Settings}
              />
            </div>
          </div>
        )}

        {/* Seção Admin (admin + ti) */}
        {isAdmin && (
          <div className="mb-2">
            {!collapsed && (
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-blue-300 uppercase tracking-wider">
                Administração
              </p>
            )}
            {collapsed && <div className="border-t border-blue-600 my-1 mx-2" />}
            <div className="px-2 space-y-0.5">
              {adminItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
    </>
  );
}
