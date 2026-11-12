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

export interface RegistrationPanel {
  registered: boolean;
  waitlisted: boolean;
  slotsUsed: number;
  waitlistCount: number;
}

/**
 * Atualiza o quadro do evento com o status que /api/eventos/[id]/inscrever
 * devolveu. Ao cancelar com fila, a API promove o primeiro da fila: os
 * inscritos ficam iguais e a fila diminui. Sair da fila não mexe nos inscritos.
 */
export function afterRegistrationChange(
  prev: RegistrationPanel,
  result: "registered" | "waitlist" | "unregistered" | "left_waitlist"
): RegistrationPanel {
  switch (result) {
    case "registered":
      return { ...prev, registered: true, slotsUsed: prev.slotsUsed + 1 };
    case "waitlist":
      return { ...prev, waitlisted: true, waitlistCount: prev.waitlistCount + 1 };
    case "left_waitlist":
      return { ...prev, waitlisted: false, waitlistCount: Math.max(0, prev.waitlistCount - 1) };
    case "unregistered":
      return prev.waitlistCount > 0
        ? { ...prev, registered: false, waitlistCount: prev.waitlistCount - 1 }
        : { ...prev, registered: false, slotsUsed: Math.max(0, prev.slotsUsed - 1) };
  }
}
