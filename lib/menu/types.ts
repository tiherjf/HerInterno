export type StaffRole =
  | "admin"
  | "ti"
  | "marketing"
  | "rh"
  | "recepcao"
  | "enfermagem"
  | "administrativo"
  | "manutencao";

export const ALL_ROLES: StaffRole[] = [
  "admin",
  "ti",
  "marketing",
  "rh",
  "recepcao",
  "enfermagem",
  "administrativo",
  "manutencao",
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
};

export const CATEGORY_ORDER = [
  "Comunicação",
  "Clínica",
  "Capacitação",
  "Suporte",
  "Ponto & RH",
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
}

export interface UserMenuPermission {
  key: string;
  canEdit: boolean;
}
