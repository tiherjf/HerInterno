/**
 * Estado de um evento para o usuário logado, na mesma regra da API de
 * inscrição (`/api/eventos/[id]/inscrever`): prazo vencido bloqueia; lotado
 * (slots_used >= max_slots) manda para a fila; max_slots nulo = sem limite.
 */

export type EventStatus =
  | "open" // pode se inscrever
  | "registered" // inscrito
  | "waitlisted" // na fila de espera
  | "full" // lotado: pode entrar na fila
  | "closed" // prazo de inscrição vencido
  | "ended" // evento já aconteceu
  | "participated"; // já aconteceu e a pessoa estava inscrita

export interface EventStatusInput {
  event_date: string;
  registration_deadline: string | null;
  max_slots: number | null;
  slots_used: number;
  is_registered: boolean;
  on_waitlist: boolean;
}

export function isUnlimited(maxSlots: number | null): boolean {
  return maxSlots === null || maxSlots === undefined;
}

export function eventStatus(ev: EventStatusInput, now: Date): EventStatus {
  if (new Date(ev.event_date).getTime() < now.getTime()) {
    return ev.is_registered ? "participated" : "ended";
  }
  if (ev.is_registered) return "registered";
  if (ev.on_waitlist) return "waitlisted";
  if (ev.registration_deadline && new Date(ev.registration_deadline).getTime() < now.getTime()) return "closed";
  if (!isUnlimited(ev.max_slots) && ev.slots_used >= (ev.max_slots as number)) return "full";
  return "open";
}
