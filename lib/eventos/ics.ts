/** Monta o arquivo .ics ("Adicionar à minha agenda") de um evento. RFC 5545. */

export interface IcsEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_link: string | null;
  event_date: string;
}

/** O evento não tem horário de término: o compromisso entra com 1 hora. */
const DURATION_MS = 60 * 60 * 1000;

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(ev: IcsEvent, url: string, now: Date): string {
  const start = new Date(ev.event_date);
  const end = new Date(start.getTime() + DURATION_MS);
  const description = [ev.description, ev.meeting_link ? `Link da reunião: ${ev.meeting_link}` : null, url]
    .filter(Boolean)
    .join("\n\n");
  const location = ev.location || ev.meeting_link;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HER//Intranet//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.id}@intranet-her`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    location ? `LOCATION:${esc(location)}` : null,
    `DESCRIPTION:${esc(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);

  return lines.join("\r\n") + "\r\n";
}
