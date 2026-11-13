import { requireStaff } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import EventoDetailClient, { ParticipantesPanel } from "./EventoDetailClient";
import { ArrowLeft, CalendarDays, CalendarPlus, Clock, Edit, MapPin, Video } from "lucide-react";
import { CoverImage } from "@/components/ui-her/CoverImage";
import { categoryLabel, eventLongDate, eventPlace, eventTime } from "@/lib/eventos/labels";
import { relativeDaysLabel } from "@/lib/eventos/dates";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

const TYPE_LABELS: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
  hibrido: "Híbrido",
};

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long" }).format(new Date(iso));

export default async function EventoDetailPage({ params }: Params) {
  const profile = await requireStaff();
  const svc = createServiceClient();

  // Tudo depende só de params.id e do usuário → uma rodada em paralelo
  // (antes eram 5 idas ao banco em sequência)
  const [{ data: ev }, { data: reg }, { data: wl }, { count: wlCount }, isOrganizer] =
    await Promise.all([
      svc
        .from("events")
        .select("*")
        .eq("id", params.id)
        .eq("active", true)
        .single(),
      svc
        .from("event_registrations")
        .select("checked_in, checked_in_at")
        .eq("event_id", params.id)
        .eq("user_id", profile.id)
        .maybeSingle(),
      svc
        .from("event_waitlist")
        .select("joined_at")
        .eq("event_id", params.id)
        .eq("user_id", profile.id)
        .maybeSingle(),
      svc
        .from("event_waitlist")
        .select("*", { count: "exact", head: true })
        .eq("event_id", params.id),
      canEditMenuItem("eventos", profile.role as StaffRole),
    ]);

  if (!ev) notFound();
  const isPast = new Date(ev.event_date) < new Date();

  const rel = isPast ? null : relativeDaysLabel(ev.event_date, new Date());
  const place = eventPlace(ev);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/intranet/eventos" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary">
          <ArrowLeft size={16} /> Eventos
        </Link>
        {isOrganizer && (
          <Link href={`/intranet/eventos/${params.id}/editar`}>
            <Button variant="outline" size="sm"><Edit size={14} className="mr-1.5" /> Editar</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Capa: no celular vem primeiro, antes do quadro */}
        <div className="order-1 min-w-0 lg:col-start-1">
          <article className="overflow-hidden rounded-xl border border-border bg-card">
            {(() => {
              const placeholder = (
                <div className="flex h-40 items-center justify-center bg-accent text-primary">
                  <CalendarDays size={48} strokeWidth={1.5} />
                </div>
              );
              return ev.cover_url
                ? <CoverImage src={ev.cover_url} alt={ev.title} zoomable className="h-72 md:h-96" fallback={placeholder} />
                : placeholder;
            })()}
            <div className="space-y-3 p-5 sm:p-7">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {categoryLabel(ev.category)}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {TYPE_LABELS[ev.type] ?? ev.type}
                </span>
                {ev.is_mandatory && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">Obrigatório</span>
                )}
              </div>
              <h1 className="text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{ev.title}</h1>
            </div>
          </article>
        </div>

        {/* Quadro lateral */}
        <aside className="order-2 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            {rel && <p className="text-xs font-bold uppercase tracking-wider text-primary">{rel}</p>}
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><CalendarDays size={16} /></span>
                <div>
                  <p className="font-semibold text-slate-900">{eventLongDate(ev.event_date)}</p>
                  <p className="text-slate-500">{eventTime(ev.event_date)}</p>
                </div>
              </li>
              {(place || ev.meeting_link) && (
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    {ev.location ? <MapPin size={16} /> : <Video size={16} />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{place || "Online"}</p>
                    {ev.meeting_link && (
                      <a href={ev.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Acessar link da reunião
                      </a>
                    )}
                  </div>
                </li>
              )}
              {ev.registration_deadline && (
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Clock size={16} /></span>
                  <div>
                    <p className="font-semibold text-slate-900">Inscrições até</p>
                    <p className="text-slate-500">{shortDate(ev.registration_deadline)}</p>
                  </div>
                </li>
              )}
            </ul>

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
              waitlistCount={wlCount ?? 0}
            />

            {!isPast && (
              <a
                href={`/api/eventos/${params.id}/ics`}
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <CalendarPlus size={15} /> Adicionar à minha agenda
              </a>
            )}
          </div>
        </aside>

        {/* Descrição e participantes */}
        <div className="order-3 min-w-0 space-y-6 lg:col-start-1">
          {ev.description && (
            <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
              <h2 className="mb-2 text-base font-semibold text-slate-900">Sobre o evento</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{ev.description}</p>
            </section>
          )}
          {isOrganizer && <ParticipantesPanel eventId={params.id} userId={profile.id} />}
        </div>
      </div>
    </div>
  );
}
