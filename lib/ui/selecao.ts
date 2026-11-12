/** Mantém a seleção de uma lista: o atual se ainda está visível; senão o primeiro; null se vazia. */
export function selecaoValida(idsVisiveis: string[], atual: string | null): string | null {
  if (atual !== null && idsVisiveis.includes(atual)) return atual;
  return idsVisiveis[0] ?? null;
}

/** Ficha aberta no celular: só continua aberta se o item ainda está na lista. */
export function fichaCelularValida(idsVisiveis: string[], aberto: string | null): string | null {
  return aberto !== null && idsVisiveis.includes(aberto) ? aberto : null;
}
