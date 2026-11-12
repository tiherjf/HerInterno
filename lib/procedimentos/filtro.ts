/** Regras puras da consulta de procedimentos e exames. */
import type { Procedimento, TipoKey } from "./types";
import { normalizarTexto } from "../../components/corpo-clinico/agenda";

export interface FiltrosProc {
  busca: string;
  unidade: string | null; // null = todas
  tipo: TipoKey | null; // null = todos
  medico: string | null; // null = todos
}

/** Médicos do item: prefere `medicos[]`; senão divide o legado `profissional` em " e " / "," / ";". */
export function medicosDe(p: Procedimento): string[] {
  if (p.medicos && p.medicos.length) return p.medicos;
  if (p.profissional) {
    return p.profissional.split(/\s+e\s+|[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function filtrarProcedimentos(lista: Procedimento[], f: FiltrosProc): Procedimento[] {
  const termo = normalizarTexto(f.busca).trim();
  const contem = (v: string | null) => !!v && normalizarTexto(v).includes(termo);
  return lista.filter((p) => {
    if (f.unidade !== null && p.unidade !== f.unidade) return false;
    if (f.tipo !== null && p.tipo !== f.tipo) return false;
    const meds = medicosDe(p);
    if (f.medico !== null && !meds.includes(f.medico)) return false;
    if (!termo) return true;
    return (
      contem(p.nome) || contem(p.descricao) || contem(p.preparacao) || contem(p.categoria) ||
      contem(p.profissional) || meds.some((m) => contem(m))
    );
  });
}

/**
 * Agrupa por categoria. Categorias ordenadas pelo menor `order_num` que contêm;
 * itens sem categoria (`categoria: null`, exibido como "Geral") vão por último.
 */
export function agruparPorCategoria(lista: Procedimento[]): { categoria: string | null; itens: Procedimento[] }[] {
  const mapa = new Map<string | null, Procedimento[]>();
  for (const p of lista) {
    const cat = p.categoria?.trim() || null;
    const g = mapa.get(cat);
    if (g) g.push(p); else mapa.set(cat, [p]);
  }
  return Array.from(mapa, ([categoria, itens]) => ({
    categoria,
    itens,
    min: Math.min(...itens.map((i) => i.order_num ?? Number.MAX_SAFE_INTEGER)),
  }))
    .sort((a, b) => {
      if (a.categoria === null) return 1;
      if (b.categoria === null) return -1;
      return a.min - b.min;
    })
    .map(({ categoria, itens }) => ({ categoria, itens }));
}

/** Médicos distintos da unidade (null = todas), em ordem alfabética. */
export function medicosDaUnidade(lista: Procedimento[], unidade: string | null): string[] {
  const set = new Set<string>();
  for (const p of lista) {
    if (unidade !== null && p.unidade !== unidade) continue;
    for (const m of medicosDe(p)) set.add(m);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
