/**
 * Valida a data de nascimento enviada pelo perfil ou pelo admin.
 * - undefined → campo não enviado (não altera)
 * - null ou "" → apagar a data
 * - "AAAA-MM-DD" existente, no passado e depois de 1900 → a própria string
 * Qualquer outra coisa lança Error("Data de nascimento inválida").
 */
export function parseBirthDate(value: unknown, now: Date = new Date()): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const invalid = () => new Error("Data de nascimento inválida");
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid();

  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Date "corrige" 30/02 para 02/03 — se mudou, a data não existe
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw invalid();
  if (y < 1900 || date.getTime() > now.getTime()) throw invalid();

  return value;
}
