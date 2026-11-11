import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDevSession, devSessionToStaffProfile, isDev } from "./dev-mode";

export type StaffRole =
  | "admin"
  | "ti"
  | "marketing"
  | "rh"
  | "recepcao"
  | "enfermagem"
  | "administrativo"
  | "manutencao"
  | "qualidade";

/** Colunas de profiles que qualquer usuário logado pode ler (tudo menos birth_date). */
export const PROFILE_PUBLIC_COLUMNS =
  "id, full_name, role, sector, unit, phone_ext, active, created_at, is_manager, manager_id, avatar_url";

export interface StaffProfile {
  id: string;
  full_name: string;
  role: StaffRole;
  sector: string;
  unit: string;
  phone_ext: string;
  active: boolean;
  is_manager?: boolean;
  manager_id?: string | null;
}

// cache(): layout e página da mesma requisição compartilham o resultado,
// evitando repetir getUser + consulta de perfil a cada nível da árvore
export const getStaffProfile = cache(async function getStaffProfile(): Promise<StaffProfile | null> {
  // Dev mode: retorna perfil fake sem Supabase
  if (isDev) {
    const devSession = getDevSession();
    if (devSession?.type === "staff") {
      return devSessionToStaffProfile(devSession);
    }
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Colunas explícitas: birth_date não é legível pelo usuário logado (migração 049)
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq("id", user.id)
    .eq("active", true)
    .single();

  return data;
});

export async function requireStaff() {
  const profile = await getStaffProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Exige perfil admin. TI NÃO é admin: acessa apenas conforme permissões (como os demais perfis). */
export async function requireAdmin() {
  const profile = await requireStaff();
  if (profile.role !== "admin") redirect("/intranet");
  return profile;
}

export function canCreateNews(role: StaffRole): boolean {
  return ["admin", "ti", "marketing", "rh"].includes(role);
}

export function canDeleteNews(role: StaffRole): boolean {
  return ["admin", "ti"].includes(role);
}

export function canManageTrainings(role: StaffRole): boolean {
  return ["admin", "ti", "rh"].includes(role);
}

export function canManageExtensions(role: StaffRole): boolean {
  return ["admin", "ti"].includes(role);
}

export function canManageEvents(role: StaffRole): boolean {
  return ["admin", "ti", "marketing"].includes(role);
}

export function canManageDocuments(role: StaffRole): boolean {
  return ["admin", "ti", "rh"].includes(role);
}

export function canManageUsers(role: StaffRole): boolean {
  return ["admin", "ti"].includes(role);
}

export function canViewTrainingReports(role: StaffRole): boolean {
  return ["admin", "ti", "rh"].includes(role);
}

export function getChatPermissions(role: StaffRole) {
  return {
    queryExtensions: true,
    answerHR: true,
    answerIT: ["admin", "ti", "recepcao", "administrativo"].includes(role),
    openGLPITicket: true,
    viewGLPITickets: true,
    answerTrainings: true,
    freeChat: true,
    manageUsers: ["admin", "ti"].includes(role),
  };
}
