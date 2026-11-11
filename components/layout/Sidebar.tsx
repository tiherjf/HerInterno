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
  Monitor,
  Wrench,
  Megaphone,
  CheckSquare,
  MessageCircle,
  CalendarClock,
  Tags,
  LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { StaffRole } from "@/lib/auth/staff";
import type { MenuItemConfig } from "@/lib/menu/types";
import { NotificacaoDot } from "@/components/news/NotificacaoDot";
import { useChatUnread } from "@/components/chat/ChatProvider";
import { useMobileSidebar } from "@/components/layout/MobileSidebarContext";
import { CATEGORY_ORDER } from "@/lib/menu/types";
import { activeHref } from "@/lib/menu/active";

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
  Monitor,
  Wrench,
  Megaphone,
  CheckSquare,
  MessageCircle,
};

// Papéis com acesso à área de chamados no /admin
const TICKET_TEAM_ROLES: StaffRole[] = ["admin", "ti", "manutencao", "marketing"];

interface AdminMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Papéis que enxergam este item (mesmo mapa aplicado no middleware) */
  roles: StaffRole[];
}

const adminGroups: { label: string; items: AdminMenuItem[] }[] = [
  {
    label: "Gestão",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
      { href: "/admin/usuarios", label: "Usuários", icon: Users, roles: ["admin", "ti"] },
    ],
  },
  {
    label: "Capacitação",
    items: [
      { href: "/admin/chatbot", label: "Base de Conhecimento", icon: MessageSquare, roles: ["admin", "ti"] },
    ],
  },
  {
    label: "Suporte & TI",
    items: [
      { href: "/admin/chamados", label: "Chamados", icon: Ticket, roles: TICKET_TEAM_ROLES },
      { href: "/admin/chamados/preventivas", label: "Preventivas", icon: CalendarClock, roles: TICKET_TEAM_ROLES },
      { href: "/admin/chamados/categorias", label: "Categorias & SLA", icon: Tags, roles: TICKET_TEAM_ROLES },
      { href: "/admin/inventario", label: "Inventário TI", icon: Package, roles: ["admin", "ti"] },
    ],
  },
  // "RH → Ponto / RH" (/admin/ponto) oculto por ora, junto com o módulo de ponto.
  // Para voltar: { label: "RH", items: [{ href: "/admin/ponto", label: "Ponto / RH", icon: BarChart3, roles: ["admin"] }] }
];

interface SidebarProps {
  role: StaffRole;

  menuItems: MenuItemConfig[];
}

/** Badge vermelho com o total de mensagens não lidas do Chat Interno. */
function ChatUnreadBadge() {
  const count = useChatUnread();
  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Fora do Sidebar de propósito: declarado dentro, virava um tipo novo a cada render
// e todos os links (e o NotificacaoDot, que faz fetch ao montar) eram remontados
function NavLink({
  href,
  label,
  icon: Icon,
  showBadge,
  showChatBadge,
  currentHref,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  showBadge?: boolean;
  showChatBadge?: boolean;
  /** Link aceso agora (o mais específico que casa com a rota) */
  currentHref: string | null;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const isActive = href === currentHref;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        isActive
          ? "bg-accent text-primary font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-primary"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
      title={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        size={18}
        className={cn("shrink-0", isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600")}
      />
      {!collapsed && <span>{label}</span>}
      {!collapsed && showBadge && <NotificacaoDot />}
      {!collapsed && showChatBadge && <ChatUnreadBadge />}
    </Link>
  );
}

export function Sidebar({ role, menuItems }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const { isOpen: mobileOpen, close } = useMobileSidebar();
  // Filtra os grupos admin conforme o papel (mesmo mapa do middleware)
  const visibleAdminGroups = adminGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
  // Edição de permissões de menu é exclusiva do admin
  const canConfig = ["admin", "ti"].includes(role);

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
  // Só um item aceso: o mais específico (antes /admin acendia junto com /admin/chamados)
  const currentHref = activeHref(pathname, [
    "/intranet",
    ...menuItems.map((i) => i.href),
    ...(canConfig ? ["/intranet/configuracoes/menu"] : []),
    ...visibleAdminGroups.flatMap((g) => g.items.map((i) => i.href)),
  ]);
  const linkProps = { currentHref, collapsed, onNavigate: close };

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
          "flex flex-col bg-white border-r border-border text-slate-600 transition-all duration-300",
          // Mobile: overlay fixo
          "fixed inset-y-0 left-0 z-50",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: sempre visível no fluxo normal
          "lg:relative lg:translate-x-0 lg:min-h-screen",
          collapsed ? "w-16" : "w-64"
        )}
      >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2 h-16 border-b border-border",
          collapsed ? "flex-col justify-center px-2 h-auto py-3" : "justify-between px-4"
        )}
      >
        <Link href="/intranet" onClick={close} className="shrink-0" title="Início">
          {collapsed ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-wide text-white">
              HER
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/brand/logo-horizontal.png"
              alt="Hospital Evandro Ribeiro"
              className="h-10 w-auto"
            />
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* Início — sempre fixo */}
        <div className="px-2 mb-2">
          <NavLink href="/intranet" label="Início" icon={Home} {...linkProps} />
        </div>

        {/* Grupos de categorias */}
        {allGroups.map(({ category, items }) => (
          <div key={category} className="mb-2">
            {!collapsed && (
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {category}
              </p>
            )}
            {collapsed && <div className="border-t border-border my-1 mx-2" />}
            <div className="px-2 space-y-0.5">
              {items.map((item) => {
                const Icon = ICON_MAP[item.icon] ?? FileText;
                return (
                  <NavLink {...linkProps}
                    key={item.key}
                    href={item.href}
                    label={item.label}
                    icon={Icon}
                    showBadge={item.key === "noticias"}
                    showChatBadge={item.key === "chat"}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Configurações (somente admin) */}
        {canConfig && (
          <div className="mb-2">
            {!collapsed && (
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Configurações
              </p>
            )}
            {collapsed && <div className="border-t border-border my-1 mx-2" />}
            <div className="px-2">
              <NavLink {...linkProps}
                href="/intranet/configuracoes/menu"
                label="Permissões de Menu"
                icon={Settings}
              />
            </div>
          </div>
        )}

        {/* Seção Admin agrupada por categoria, filtrada por papel */}
        {visibleAdminGroups.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {group.label}
              </p>
            )}
            {collapsed && <div className="border-t border-border my-1 mx-2" />}
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => (
                <NavLink {...linkProps}
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
    </>
  );
}
