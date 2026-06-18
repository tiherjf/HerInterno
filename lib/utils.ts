import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function cleanCPF(cpf: string) {
  return cpf.replace(/\D/g, "");
}

export function validateCPF(cpf: string): boolean {
  const cleaned = cleanCPF(cpf);
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned[10]);
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  ti: "TI",
  marketing: "Marketing",
  rh: "Recursos Humanos",
  recepcao: "Recepção",
  enfermagem: "Enfermagem",
  administrativo: "Administrativo",
  manutencao: "Manutenção",
};

export const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  ti: "bg-purple-100 text-purple-800",
  marketing: "bg-green-100 text-green-800",
  rh: "bg-yellow-100 text-yellow-800",
  recepcao: "bg-blue-100 text-blue-800",
  enfermagem: "bg-pink-100 text-pink-800",
  administrativo: "bg-gray-100 text-gray-800",
  manutencao: "bg-orange-100 text-orange-800",
};
