// Modo de desenvolvimento sem Supabase
// Ativo SOMENTE quando NODE_ENV=development E cookie dev_session está presente

import { cookies } from "next/headers";
import type { StaffProfile } from "./staff";
import type { PatientPayload } from "./patient";

export const DEV_COOKIE = "dev_session";
export const isDev = process.env.NODE_ENV === "development";

export interface DevSession {
  type: "staff" | "patient";
  id: string;
  name: string;
  // staff only
  role?: string;
  sector?: string;
  is_manager?: boolean;
  // patient only
  cpf?: string;
}

export const DEV_USERS: Record<string, DevSession> = {
  admin: {
    type: "staff",
    id: "dev-admin-001",
    name: "Admin Teste",
    role: "admin",
    sector: "TI",
    is_manager: true,
  },
  ti: {
    type: "staff",
    id: "dev-ti-001",
    name: "Ana TI Teste",
    role: "ti",
    sector: "TI",
    is_manager: true,
  },
  marketing: {
    type: "staff",
    id: "dev-marketing-001",
    name: "Carlos Marketing",
    role: "marketing",
    sector: "Marketing",
  },
  rh: {
    type: "staff",
    id: "dev-rh-001",
    name: "Daniela RH",
    role: "rh",
    sector: "Recursos Humanos",
    is_manager: true,
  },
  recepcao: {
    type: "staff",
    id: "dev-recepcao-001",
    name: "Eduardo Recepção",
    role: "recepcao",
    sector: "Recepção",
  },
  enfermagem: {
    type: "staff",
    id: "dev-enf-001",
    name: "Fernanda Enfermagem",
    role: "enfermagem",
    sector: "UTI",
  },
  administrativo: {
    type: "staff",
    id: "dev-adm-001",
    name: "Gustavo Administrativo",
    role: "administrativo",
    sector: "Administração",
  },
  paciente: {
    type: "patient",
    id: "dev-patient-001",
    name: "Maria Paciente Silva",
    cpf: "12345678900",
  },
};

export function getDevSession(): DevSession | null {
  if (!isDev) return null;
  try {
    const cookieStore = cookies();
    const raw = cookieStore.get(DEV_COOKIE)?.value;
    if (!raw) return null;
    return JSON.parse(raw) as DevSession;
  } catch {
    return null;
  }
}

export function devSessionToStaffProfile(session: DevSession): StaffProfile {
  return {
    id: session.id,
    full_name: session.name,
    role: session.role as StaffProfile["role"],
    sector: session.sector || "Geral",
    unit: "Matriz",
    phone_ext: "1234",
    active: true,
    is_manager: session.is_manager || false,
  };
}

export function devSessionToPatient(session: DevSession): PatientPayload {
  return {
    sub: session.id,
    cpf: session.cpf || "00000000000",
    name: session.name,
  };
}
