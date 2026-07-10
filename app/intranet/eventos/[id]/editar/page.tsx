import { requireStaff } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EventForm from "@/components/eventos/EventForm";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

export default async function EditarEventoPage({ params }: Params) {
  const profile = await requireStaff();
  if (!(await canEditMenuItem("eventos", profile.role as StaffRole))) redirect("/intranet/eventos");

  const svc = createServiceClient();
  const { data: ev } = await svc
    .from("events")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!ev) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Editar Evento</h2>
        <p className="text-muted-foreground text-sm mt-1">{ev.title}</p>
      </div>
      <EventForm
        initialData={{
          id: ev.id,
          title: ev.title,
          description: ev.description ?? "",
          category: ev.category ?? "outro",
          type: ev.type ?? "presencial",
          location: ev.location ?? "",
          meeting_link: ev.meeting_link ?? "",
          event_date: ev.event_date,
          registration_deadline: ev.registration_deadline ?? "",
          max_slots: ev.max_slots,
          cover_url: ev.cover_url ?? "",
          is_mandatory: ev.is_mandatory ?? false,
        }}
      />
    </div>
  );
}
