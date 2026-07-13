/**
 * Escopo de equipe dos chamados (ti, manutencao, marketing).
 *
 * Regra central: um papel de agente (ti/manutencao/marketing) só atua como
 * AGENTE em tickets/categorias da própria equipe. Para tickets de outras
 * equipes ele é tratado como solicitante comum (só vê/atua se for o
 * requester). Admin não tem equipe e enxerga tudo.
 */

export const CHAMADOS_TEAMS = ["ti", "manutencao", "marketing"] as const;
export type ChamadosTeam = (typeof CHAMADOS_TEAMS)[number];

/** Papéis que podem atuar como agentes de chamados (inclui admin). */
export const AGENT_ROLES = ["admin", "ti", "manutencao", "marketing"];

/**
 * Equipe do agente. Retorna null para admin (vê todas as equipes) e para
 * papéis não-agentes.
 */
export function agentTeam(role: string): ChamadosTeam | null {
  if (role === "ti" || role === "manutencao" || role === "marketing") return role;
  return null; // admin vê tudo; demais papéis não são agentes
}

/**
 * O usuário atua como AGENTE neste ticket?
 * Admin: sempre. ti/manutencao/marketing: apenas se o ticket for da própria
 * equipe. Qualquer outro papel: nunca.
 */
export function isAgentForTicket(role: string, ticketTeam: string | null | undefined): boolean {
  if (role === "admin") return true;
  const team = agentTeam(role);
  return team !== null && team === ticketTeam;
}
