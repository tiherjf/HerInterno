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

export const ALL_ROLES: StaffRole[] = [
  "admin",
  "ti",
  "marketing",
  "rh",
  "recepcao",
  "enfermagem",
  "administrativo",
  "manutencao",
  "qualidade",
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  ti: "TI",
  marketing: "Marketing",
  rh: "RH",
  recepcao: "Recepção",
  enfermagem: "Enfermagem",
  administrativo: "Administrativo",
  manutencao: "Manutenção",
  qualidade: "Qualidade",
};

export const CATEGORY_ORDER = [
  "Comunicação",
  "Corpo Clínico e Procedimentos",
  "Capacitação",
  "Suporte",
  "Ponto & RH",
  "Qualidade",
] as const;

export interface MenuItemConfig {
  key: string;
  label: string;
  href: string;
  icon: string;
  category: string;
  order_num: number;
  can_view: StaffRole[];
  can_edit: StaffRole[];
  active: boolean;
  updated_at?: string | null;
  updated_by_name?: string | null;
}

export interface UserMenuPermission {
  key: string;
  canEdit: boolean;
}
