/** Rótulos e formatos compartilhados das telas de eventos (horário de Brasília). */

export const CATEGORY_LABELS: Record<string, string> = {
  palestra: "Palestra",
  treinamento: "Treinamento",
  confraternizacao: "Confraternização",
  comemoracao: "Comemoração",
  curso: "Curso",
  outro: "Outro",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

const TZ = "America/Sao_Paulo";

/** "14:00" */
export function eventTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** "Sexta-feira, 14 de novembro" */
export function eventLongDate(iso: string): string {
  const s = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(iso)
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Onde: o local; para evento online sem local, "Online". */
export function eventPlace(ev: { location: string | null; type?: string | null }): string {
  if (ev.location) return ev.location;
  return ev.type === "online" ? "Online" : "";
}
