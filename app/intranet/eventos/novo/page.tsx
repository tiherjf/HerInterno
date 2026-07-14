import { requireStaff } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import { redirect } from "next/navigation";
import EventForm from "@/components/eventos/EventForm";
import type { StaffRole } from "@/lib/auth/staff";

export default async function NovoEventoPage() {
  const profile = await requireStaff();
  if (!(await canEditMenuItem("eventos", profile.role as StaffRole))) redirect("/intranet/eventos");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">Novo Evento</h2>
        <p className="text-muted-foreground text-sm mt-1">Preencha as informações do evento</p>
      </div>
      <EventForm />
    </div>
  );
}
