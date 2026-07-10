"use client";

import { Bell, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils";
import { StaffProfile } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NotificacaoDot } from "@/components/news/NotificacaoDot";
import { useMobileSidebar } from "@/components/layout/MobileSidebarContext";
import { useChatContext, type ChatStatus } from "@/components/chat/ChatProvider";

const CHAT_STATUS_META: Record<ChatStatus, { label: string; dot: string; next: ChatStatus }> = {
  disponivel: { label: "Disponível", dot: "bg-green-500", next: "ausente" },
  ausente: { label: "Ausente", dot: "bg-yellow-400", next: "ocupado" },
  ocupado: { label: "Ocupado", dot: "bg-red-500", next: "disponivel" },
};

/** Seletor compacto do status do chat: clique alterna disponível → ausente → ocupado. */
function ChatStatusDot() {
  const chat = useChatContext();
  if (!chat) return null;
  const meta = CHAT_STATUS_META[chat.myStatus];
  return (
    <button
      type="button"
      onClick={() => chat.setMyStatus(meta.next)}
      className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition-colors"
      title={`Chat: ${meta.label} — clique para alterar`}
      aria-label={`Status do chat: ${meta.label}. Clique para alterar.`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
    </button>
  );
}

interface HeaderProps {
  profile: StaffProfile;
}

export function Header({ profile }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const { toggle } = useMobileSidebar();

  const initials = profile.full_name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="h-16 border-b bg-white/95 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 shadow-sm">
      {/* Marca */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden -ml-1 text-gray-600"
          onClick={toggle}
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </Button>
        <div className="w-8 h-8 brand-gradient rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm leading-none">HER</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-gray-800 leading-tight">Intranet HER</p>
          <p className="text-[10px] text-gray-400 leading-tight">Hospital Evandro Ribeiro</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <ChatStatusDot />
        <Link href="/intranet/noticias" title="Notificações" className="relative inline-flex">
          <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-800">
            <Bell size={18} />
          </Button>
          <NotificacaoDot corner />
        </Link>

        <div className="flex items-center gap-2.5 pl-2 border-l ml-1">
          <Link href="/intranet/perfil" title="Meu perfil">
            <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-primary/40 transition-all cursor-pointer">
              <AvatarFallback className="brand-gradient text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-800 leading-tight">{profile.full_name.split(" ")[0]}</p>
            <Badge className={`text-[10px] border-0 px-1.5 py-0.5 ${ROLE_COLORS[profile.role]}`}>
              {ROLE_LABELS[profile.role]}
            </Badge>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Sair"
          className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={17} />
        </Button>
      </div>
    </header>
  );
}
