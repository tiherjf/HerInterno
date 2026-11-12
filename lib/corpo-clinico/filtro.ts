/** Regras puras da consulta do corpo clínico (busca, convênio, unidade, agenda). */
import type { Profissional } from "./types";
import { atendeNoDia, normalizarTexto, turnosDe, type Turno } from "../../components/corpo-clinico/agenda";

export interface FiltrosCC {
  busca: string;
  convenio: string;
  unidade: string | null;
  grupo: string | null;
  hoje: boolean;
  turnos: Turno[];
}

export interface ResultadoCC {
  /** Quem passa em todos os filtros (e atende o convênio, quando há). */
  principais: Profissional[];
  /** Com filtro de convênio: quem não tem nenhum convênio cadastrado. */
  naoInformado: Profissional[];
}

const norm = (s: string) => normalizarTexto(s).trim();

/** Convênios sem vazios nem nulos (um NULL dentro do text[] do banco não pode derrubar a tela). */
export function limparConvenios(lista: readonly (string | null | undefined)[] | null | undefined): string[] {
  return (lista ?? []).filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim());
}

function conveniosValidos(p: Profissional): string[] {
  return limparConvenios(p.convenios);
}

/** Convênios do profissional que casam com o termo (por parte do nome, sem acento). */
export function conveniosQueCasam(p: Profissional, termo: string): string[] {
  const t = norm(termo);
  if (!t) return [];
  return conveniosValidos(p).filter((c) => normalizarTexto(c).includes(t));
}

function casaBusca(p: Profissional, termo: string): boolean {
  if (!termo) return true;
  const contem = (v?: string | null) => !!v && normalizarTexto(v).includes(termo);
  return (
    contem(p.nome) || contem(p.especialidade) || contem(p.grupo) || contem(p.dias) ||
    contem(p.horarios) || contem(p.unidade) || contem(p.subespecialidade) || contem(p.local) ||
    contem(p.observacoes) || conveniosValidos(p).some((c) => contem(c))
  );
}

/** Aplica os filtros mantendo a ordem de entrada. */
export function filtrarProfissionais(lista: Profissional[], f: FiltrosCC, diaSemana: number): ResultadoCC {
  const termo = norm(f.busca);
  const conv = norm(f.convenio);
  const principais: Profissional[] = [];
  const naoInformado: Profissional[] = [];
  for (const p of lista) {
    if (f.unidade && p.unidade !== f.unidade) continue;
    if (f.grupo && p.grupo !== f.grupo) continue;
    if (f.hoje && !atendeNoDia(p.agenda, p.dias, diaSemana)) continue;
    if (f.turnos.length > 0) {
      const ts = turnosDe(p.agenda, p.horarios);
      if (!f.turnos.some((t) => ts.has(t))) continue;
    }
    if (!casaBusca(p, termo)) continue;
    if (conv) {
      if (conveniosValidos(p).length === 0) { naoInformado.push(p); continue; }
      if (conveniosQueCasam(p, conv).length === 0) continue;
    }
    principais.push(p);
  }
  return { principais, naoInformado };
}

/** Agrupa por especialidade (grupo), na ordem da primeira aparição. */
export function agruparPorGrupo(lista: Profissional[]): { grupo: string; itens: Profissional[] }[] {
  const grupos = new Map<string, Profissional[]>();
  for (const p of lista) {
    const g = grupos.get(p.grupo);
    if (g) g.push(p); else grupos.set(p.grupo, [p]);
  }
  return Array.from(grupos, ([grupo, itens]) => ({ grupo, itens }));
}

const IGNORAR = new Set(["dr", "dra", "de", "da", "do", "dos", "das", "e"]);

/** Até duas iniciais do nome, sem títulos ("Dr.", "Dra.") nem preposições. */
export function iniciais(nome: string): string {
  const partes = nome
    .split(/\s+/)
    .map((p) => p.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, ""))
    .filter((p) => p && !IGNORAR.has(p.toLowerCase()));
  if (partes.length === 0) return "";
  const letras = partes.length === 1 ? [partes[0]] : [partes[0], partes[partes.length - 1]];
  return letras.map((p) => p[0].toUpperCase()).join("");
}
