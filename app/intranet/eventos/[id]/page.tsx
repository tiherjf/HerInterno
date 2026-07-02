import { requireStaff, canManageEvents } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EventoDetailClient from "./EventoDetailClient";
import { Calendar, MapPin, Video, Users, Clock, Edit, Star } from "lucide-react";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

const TYPE_LABELS: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
  hibrido: "Híbrido",
};

const CAT_LABELS: Record<string, string> = {
  palestra: "Palestra",
  treinamento: "Treinamento",
  confraternizacao: "Confraternização",
  comemoracao: "Comemoração",
  curso: "Curso",
  outro: "Outro",
};

function formatDT(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

export default async function EventoDetailPage({ params }: Params) {
  const profile = await requireStaff();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("events")
    .select("*")
    .eq("id", params.id)
    .eq("active", true)
    .single();

  if (!ev) notFound();

  const { data: reg } = await svc
    .from("event_registrations")
    .select("checked_in, checked_in_at")
    .eq("event_id", params.id)
    .eq("user_id", profile.id)
    .maybeSingle();

  const { data: wl } = await svc
    .from("event_waitlist")
    .select("joined_at")
    .eq("event_id", params.id)
    .eq("user_id", profile.id)
    .maybeSingle();

  const { count: wlCount } = await svc
    .from("event_waitlist")
    .select("*", { count: "exact", head: true })
    .eq("event_id", params.id);

  const isOrganizer = canManageEvents(profile.role as StaffRole);
  const isPast = new Date(ev.event_date) < new Date();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cover */}
      {ev.cover_url && (
        <div className="w-full aspect-video rounded-xl overflow-hidden">
          <img src={ev.cover_url} alt={ev.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {CAT_LABELS[ev.category] ?? ev.category}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {TYPE_LABELS[ev.type] ?? ev.type}
            </span>
            {ev.is_mandatory && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                Obrigatório
              </span>
            )}
            {isPast && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Encerrado
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{ev.title}</h1>
        </div>
        {isOrganizer && (
          <Link href={`/intranet/eventos/${params.id}/editar`}>
            <Button variant="outline" size="sm">
              <Edit size={14} className="mr-1.5" /> Editar
            </Button>
          </Link>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
          <Calendar size={18} className="text-primary mt-0.5" />
          <div>
            <div className="font-medium">Data e hora</div>
            <div className="text-muted-foreground capitalize">{formatDT(ev.event_date)}</div>
          </div>
        </div>
        {ev.location && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <MapPin size={18} className="text-primary mt-0.5" />
            <div>
              <div className="font-medium">Local</div>
              <div className="text-muted-foreground">{ev.location}</div>
            </div>
          </div>
        )}
        {ev.meeting_link && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <Video size={18} className="text-primary mt-0.5" />
            <div>
              <div className="font-medium">Reunião online</div>
              <a href={ev.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Acessar link
              </a>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
          <Users size={18} className="text-primary mt-0.5" />
          <div>
            <div className="font-medium">Vagas</div>
            <div className="text-muted-foreground">
              {ev.slots_used}/{ev.max_slots} inscritos
              {wlCount ? ` · ${wlCount} na fila` : ""}
            </div>
          </div>
        </div>
        {ev.registration_deadline && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <Clock size={18} className="text-primary mt-0.5" />
            <div>
              <div className="font-medium">Prazo de inscrição</div>
              <div className="text-muted-foreground">{formatDate(ev.registration_deadline)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Descrição */}
      {ev.description && (
        <div className="prose prose-sm max-w-none">
          <h3 className="font-semibold text-base mb-2">Sobre o evento</h3>
          <p className="text-muted-foreground whitespace-pre-line">{ev.description}</p>
        </div>
      )}

      {/* Interações do usuário + participantes (client) */}
      <EventoDetailClient
        eventId={params.id}
        event={{
          max_slots: ev.max_slots,
          slots_used: ev.slots_used,
          registration_deadline: ev.registration_deadline,
          is_past: isPast,
        }}
        initialReg={reg ? { checked_in: reg.checked_in } : null}
        initialWaitlist={wl ? { joined_at: wl.joined_at } : null}
        isOrganizer={isOrganizer}
        userId={profile.id}
      />
    </div>
  );
}
