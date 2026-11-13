/** Formatação da tela do chat. Datas e horas sempre em horário de Brasília. */

const FUSO = "America/Sao_Paulo";

const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const dataBr = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
// en-CA dá AAAA-MM-DD
const dataIso = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const horaNum = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" });

export function formatarHora(iso: string): string {
  return hora.format(new Date(iso));
}

/** Dia (AAAA-MM-DD) em Brasília — para separar mensagens por dia. */
export function chaveDia(iso: string | Date): string {
  return dataIso.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatarDia(iso: string, agora: Date): string {
  const dia = chaveDia(iso);
  if (dia === chaveDia(agora)) return "Hoje";
  if (dia === chaveDia(new Date(agora.getTime() - 24 * 60 * 60 * 1000))) return "Ontem";
  return dataBr.format(new Date(iso));
}

/** Expediente padrão 07:00–19:00 em Brasília. */
export function foraDoExpediente(agora: Date): boolean {
  const h = Number(horaNum.format(agora));
  return h < 7 || h >= 19;
}

export function formatarBytes(n?: number | null): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ehImagem(nome?: string | null): boolean {
  return /\.(jpe?g|png|webp)$/i.test(nome ?? "");
}

/** Une listas de mensagens sem repetir id, em ordem crescente de created_at. */
export function juntarMensagens<T extends { id: string; created_at: string }>(a: T[], b: T[]): T[] {
  const mapa = new Map<string, T>();
  for (const m of [...a, ...b]) mapa.set(m.id, m);
  return Array.from(mapa.values()).sort(
    (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime(),
  );
}

/** Primeira letra do primeiro e do último nome. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  const letras = partes.length === 1 ? [partes[0]] : [partes[0], partes[partes.length - 1]];
  return letras.map((p) => p[0].toUpperCase()).join("");
}
