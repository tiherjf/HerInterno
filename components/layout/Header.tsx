"use client";

import { Bell, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils";
import { StaffProfile } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NotificacaoDot } from "@/components/news/NotificacaoDot";

interface HeaderProps {
  profile: StaffProfile;
}

export function Header({ profile }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

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
    <header className="h-16 border-b bg-white/95 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-6 shadow-sm">
      {/* Marca */}
      <div className="flex items-center gap-3">
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
        <Link href="/intranet/noticias" title="Notificações" className="relative inline-flex">
          <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-800">
            <Bell size={18} />
          </Button>
          <NotificacaoDot corner />
        </Link>

        <div className="flex items-center gap-2.5 pl-2 border-l ml-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="brand-gradient text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-800 leading-tight">{profile.full_name.split(" ")[0]}</p>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                ROLE_COLORS[profile.role]
              }`}
            >
              {ROLE_LABELS[profile.role]}
            </span>
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
