import { createServiceClient } from "@/lib/supabase/server";

/** Papéis autorizados a gerenciar planos de manutenção preventiva. */
export const PLAN_MANAGER_ROLES = ["admin", "ti", "manutencao"];

// Códigos quando a tabela maintenance_plans ainda não existe (migração 041 pendente)
const MISSING_TABLE_CODES = ["PGRST205", "42P01"];

export function isMissingPlansTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.includes(error.code)) return true;
  return (
    /maintenance_plans/.test(error.message ?? "") &&
    /não existe|does not exist|schema cache/i.test(error.message ?? "")
  );
}

/** Data de hoje (YYYY-MM-DD) no fuso local do servidor. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Soma dias a uma data YYYY-MM-DD (aritmética em UTC para evitar problemas de fuso). */
export function addDaysISO(dateISO: string, days: number): string {
  const base = new Date(`${dateISO}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().split("T")[0];
}

function isValidDateISO(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export interface PlanValues {
  title?: string;
  description?: string | null;
  location?: string;
  equipment_patrimonio?: string | null;
  category_id?: string | null;
  frequency_days?: number;
  next_due?: string;
  active?: boolean;
}

/**
 * Valida o payload de criação/edição de um plano preventivo.
 * Em modo `partial` (PATCH) só valida os campos presentes no body.
 * Retorna `{ values }` prontos para insert/update ou `{ error }`.
 */
export async function validatePlanPayload(
  svc: ReturnType<typeof createServiceClient>,
  body: Record<string, unknown>,
  { partial }: { partial: boolean }
): Promise<{ values: PlanValues } | { error: string }> {
  const values: PlanValues = {};

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return { error: "Título é obrigatório" };
    values.title = title;
  }

  if (!partial || body.description !== undefined) {
    values.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }

  if (!partial || body.location !== undefined) {
    const location = typeof body.location === "string" ? body.location.trim() : "";
    if (!location) return { error: "Localização é obrigatória" };
    values.location = location;
  }

  if (!partial || body.equipment_patrimonio !== undefined) {
    values.equipment_patrimonio =
      typeof body.equipment_patrimonio === "string" && body.equipment_patrimonio.trim()
        ? body.equipment_patrimonio.trim()
        : null;
  }

  if (!partial || body.frequency_days !== undefined) {
    const freq = Number(body.frequency_days);
    if (!Number.isInteger(freq) || freq < 1) {
      return { error: "Frequência deve ser um número inteiro de dias (mínimo 1)" };
    }
    values.frequency_days = freq;
  }

  if (!partial || body.next_due !== undefined) {
    if (!isValidDateISO(body.next_due)) {
      return { error: "Próxima execução inválida (use o formato AAAA-MM-DD)" };
    }
    if (body.next_due < todayISO()) {
      return { error: "Próxima execução não pode estar no passado" };
    }
    values.next_due = body.next_due;
  }

  if (body.category_id !== undefined) {
    if (body.category_id === null || body.category_id === "") {
      values.category_id = null;
    } else if (typeof body.category_id === "string") {
      const { data: cat, error } = await svc
        .from("ticket_categories")
        .select("id, team")
        .eq("id", body.category_id)
        .maybeSingle();
      if (error) throw error;
      if (!cat || cat.team !== "manutencao") {
        return { error: "Categoria inválida: deve pertencer à equipe de manutenção" };
      }
      values.category_id = cat.id;
    } else {
      return { error: "Categoria inválida" };
    }
  }

  if (partial && body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return { error: "Campo 'active' deve ser booleano" };
    }
    values.active = body.active;
  }

  return { values };
}
