"use client";

import { useState } from "react";
import { Bell, LogOut, Menu, Search, X } from "lucide-react";
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
import { GlobalSearch } from "@/components/layout/GlobalSearch";

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
  const [mobileSearch, setMobileSearch] = useState(false);

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
    <header className="h-16 border-b border-border bg-white sticky top-0 z-30 flex items-center justify-between gap-4 px-4 md:px-8">
      {/* Busca expandida no celular: ocupa o cabeçalho inteiro */}
      {mobileSearch && (
        <div className="absolute inset-0 z-10 flex items-center gap-2 bg-white px-3 sm:hidden">
          <GlobalSearch className="flex-1" autoFocus />
          <Button variant="ghost" size="icon" onClick={() => setMobileSearch(false)} aria-label="Fechar busca">
            <X size={18} />
          </Button>
        </div>
      )}

      {/* Esquerda: menu mobile + logo (só no mobile; no desktop o logo está no menu) + busca */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden -ml-1 text-slate-600"
          onClick={toggle}
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </Button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-horizontal.png" alt="Hospital Evandro Ribeiro" className="h-7 w-auto lg:hidden" />
        <GlobalSearch className="hidden sm:block w-full max-w-md" />
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden text-slate-500"
          onClick={() => setMobileSearch(true)}
          aria-label="Buscar"
        >
          <Search size={18} />
        </Button>
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
