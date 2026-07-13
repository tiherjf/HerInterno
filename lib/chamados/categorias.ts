/**
 * Validação dos campos novos de ticket_categories (migração 042):
 * - ola_hours: meta interna de primeira resposta em horas (null ou número > 0)
 * - default_priority: prioridade padrão dos chamados da categoria
 */

export const CATEGORIA_PRIORIDADES = ["low", "medium", "high", "critical", "scheduled"];

type Resultado = { error: string; fields?: never } | { error?: never; fields: Record<string, unknown> };

/**
 * Valida ola_hours/default_priority vindos do request. Só inclui em `fields`
 * os campos que foram de fato enviados (para não forçar colunas inexistentes
 * pré-042 quando o usuário nem mexeu nelas).
 */
export function validarCamposCategoria(body: { ola_hours?: unknown; default_priority?: unknown }): Resultado {
  const fields: Record<string, unknown> = {};

  if (body.ola_hours !== undefined) {
    if (body.ola_hours === null || body.ola_hours === "") {
      fields.ola_hours = null;
    } else {
      const n = Number(body.ola_hours);
      if (!Number.isFinite(n) || n <= 0) {
        return { error: "OLA inválido — informe um número de horas maior que zero" };
      }
      fields.ola_hours = n;
    }
  }

  if (body.default_priority !== undefined && body.default_priority !== null && body.default_priority !== "") {
    if (typeof body.default_priority !== "string" || !CATEGORIA_PRIORIDADES.includes(body.default_priority)) {
      return { error: "Prioridade padrão inválida" };
    }
    fields.default_priority = body.default_priority;
  }

  return { fields };
}
