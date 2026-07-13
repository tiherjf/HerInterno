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

export async function getStaffProfile(): Promise<StaffProfile | null> {
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

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .single();

  return data;
}

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
  return role === "admin";
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
