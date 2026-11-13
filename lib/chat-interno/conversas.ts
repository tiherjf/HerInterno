/** Regras puras da tela do chat: conversas, busca de pessoas, setores, urgente e link direto. */
import type { Conversa, Mensagem, Pessoa } from "./tipos";
import { normalizarTexto } from "../../components/corpo-clinico/agenda";

const norm = (s: string | null | undefined) => normalizarTexto(s ?? "").trim();

/** Uma conversa por interlocutor. `rows` em ordem decrescente de created_at. */
export function resumirConversas(rows: Mensagem[], meuId: string): Conversa[] {
  const porPessoa = new Map<string, Conversa>();
  for (const m of rows) {
    const outro = m.sender_id === meuId ? m.recipient_id : m.sender_id;
    let c = porPessoa.get(outro);
    if (!c) {
      c = { with: outro, last_message: m, unread: 0, urgente: false };
      porPessoa.set(outro, c);
    }
    if (m.recipient_id === meuId && !m.read_at) {
      c.unread += 1;
      if (m.urgent === true) c.urgente = true;
    }
  }
  return Array.from(porPessoa.values());
}

const momento = (c: Conversa) => new Date(c.last_message.created_at).getTime();

/** Urgente não lida primeiro; depois a mais recente. */
export function ordenarConversas(lista: Conversa[]): Conversa[] {
  return lista.slice().sort((a, b) => {
    if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
    return momento(b) - momento(a);
  });
}

/** Só interlocutores do diretório (ativos); termo casa o nome. */
export function filtrarConversas(lista: Conversa[], pessoas: Map<string, Pessoa>, termo: string): Conversa[] {
  const t = norm(termo);
  return lista.filter((c) => {
    const p = pessoas.get(c.with);
    if (!p) return false;
    return !t || norm(p.full_name).includes(t);
  });
}

/** Diretório sem o próprio usuário; termo casa nome, setor ou parte do ramal. */
export function filtrarPessoas(dir: Pessoa[], termo: string, meuId: string | undefined): Pessoa[] {
  const t = norm(termo);
  return dir.filter((p) => {
    if (p.id === meuId) return false;
    if (!t) return true;
    return norm(p.full_name).includes(t) || norm(p.sector).includes(t) || norm(p.phone_ext).includes(t);
  });
}

export interface GrupoSetor {
  setor: string;
  membros: Pessoa[];
  online: number;
}

/** Setores em ordem alfabética; dentro de cada um, online primeiro e depois por nome. */
export function agruparPorSetor(pessoas: Pessoa[], online: (id: string) => boolean): GrupoSetor[] {
  const porSetor = new Map<string, Pessoa[]>();
  for (const p of pessoas) {
    const setor = p.sector?.trim() || "Sem setor";
    const lista = porSetor.get(setor);
    if (lista) lista.push(p); else porSetor.set(setor, [p]);
  }
  return Array.from(porSetor.entries())
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([setor, membros]) => ({
      setor,
      membros: membros.slice().sort((a, b) => {
        const oa = online(a.id) ? 0 : 1;
        const ob = online(b.id) ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return a.full_name.localeCompare(b.full_name, "pt-BR");
      }),
      online: membros.filter((m) => online(m.id)).length,
    }));
}

/**
 * Último urgente recebido, ainda não lido quando a conversa foi carregada, sem
 * nenhuma mensagem minha depois dele. `msgs` em ordem crescente.
 * (Já lido = a pessoa já viu a faixa antes; ela não volta ao reabrir.)
 */
export function urgentePendente(msgs: Mensagem[], meuId: string): Mensagem | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.sender_id === meuId) return null;
    if (m.urgent === true) return m.read_at ? null : m;
  }
  return null;
}

/** Pessoa a abrir pelo link `?com=` (primeiro valor), ou null se for o próprio ou não existir. */
export function alvoDoLink(com: string | string[] | undefined, dir: Pessoa[], meuId: string | undefined): Pessoa | null {
  const id = Array.isArray(com) ? com[0] : com;
  if (!id || id === meuId) return null;
  return dir.find((p) => p.id === id) ?? null;
}
