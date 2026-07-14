"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  { value: "palestra", label: "Palestra" },
  { value: "treinamento", label: "Treinamento" },
  { value: "confraternizacao", label: "Confraternização" },
  { value: "comemoracao", label: "Comemoração" },
  { value: "curso", label: "Curso" },
  { value: "outro", label: "Outro" },
];

const TYPES = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "hibrido", label: "Híbrido" },
];

export interface EventFormData {
  id?: string;
  title: string;
  description: string;
  category: string;
  type: string;
  location: string;
  meeting_link: string;
  event_date: string;
  registration_deadline: string;
  max_slots: number;
  cover_url: string;
  is_mandatory: boolean;
}

interface Props {
  initialData?: Partial<EventFormData>;
}

function toDatetimeLocal(iso: string) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export default function EventForm({ initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EventFormData>({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    category: initialData?.category ?? "outro",
    type: initialData?.type ?? "presencial",
    location: initialData?.location ?? "",
    meeting_link: initialData?.meeting_link ?? "",
    event_date: initialData?.event_date ? toDatetimeLocal(initialData.event_date) : "",
    registration_deadline: initialData?.registration_deadline
      ? toDatetimeLocal(initialData.registration_deadline)
      : "",
    max_slots: initialData?.max_slots ?? 50,
    cover_url: initialData?.cover_url ?? "",
    is_mandatory: initialData?.is_mandatory ?? false,
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!initialData?.id;
  const needsLocation = ["presencial", "hibrido"].includes(form.type);
  const needsLink = ["online", "hibrido"].includes(form.type);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Imagem deve ter no máximo 5MB.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `events/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file);
    if (upErr) { setError("Erro ao enviar imagem."); setUploading(false); return; }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setForm(f => ({ ...f, cover_url: data.publicUrl }));
    setUploading(false);
  }

  function set(field: keyof EventFormData, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.event_date) {
      setError("Título e data do evento são obrigatórios.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
      registration_deadline: form.registration_deadline
        ? new Date(form.registration_deadline).toISOString()
        : null,
      location: needsLocation ? form.location : null,
      meeting_link: needsLink ? form.meeting_link : null,
    };

    const url = isEditing ? `/api/eventos/${initialData!.id}` : "/api/eventos";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Erro ao salvar."); setSaving(false); return; }

    router.push(isEditing ? `/intranet/eventos/${initialData!.id}` : `/intranet/eventos/${json.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Capa */}
      <div className="space-y-2">
        <Label>Imagem de capa</Label>
        {form.cover_url ? (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
            <img src={form.cover_url} alt="Capa" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => set("cover_url", "")}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={28} />
            ) : (
              <>
                <ImageIcon size={28} className="mb-2" />
                <span className="text-sm">Clique para enviar imagem de capa</span>
                <span className="text-xs mt-1">PNG, JPG ou WEBP — máx. 5MB</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Título */}
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={form.title}
          onChange={e => set("title", e.target.value)}
          placeholder="Nome do evento"
          required
        />
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Detalhes sobre o evento..."
          rows={4}
        />
      </div>

      {/* Categoria + Tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={form.category} onValueChange={v => set("category", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modalidade</Label>
          <Select value={form.type} onValueChange={v => set("type", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Local (presencial/híbrido) */}
      {needsLocation && (
        <div className="space-y-2">
          <Label htmlFor="location">Local</Label>
          <Input
            id="location"
            value={form.location}
            onChange={e => set("location", e.target.value)}
            placeholder="Ex: Auditório principal, Sala 2..."
          />
        </div>
      )}

      {/* Link (online/híbrido) */}
      {needsLink && (
        <div className="space-y-2">
          <Label htmlFor="meeting_link">Link da reunião</Label>
          <Input
            id="meeting_link"
            value={form.meeting_link}
            onChange={e => set("meeting_link", e.target.value)}
            placeholder="https://meet.google.com/..."
          />
        </div>
      )}

      {/* Datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event_date">Data do evento *</Label>
          <Input
            id="event_date"
            type="datetime-local"
            value={form.event_date}
            onChange={e => set("event_date", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registration_deadline">Prazo de inscrição</Label>
          <Input
            id="registration_deadline"
            type="datetime-local"
            value={form.registration_deadline}
            onChange={e => set("registration_deadline", e.target.value)}
          />
        </div>
      </div>

      {/* Vagas */}
      <div className="space-y-2">
        <Label htmlFor="max_slots">Número de vagas</Label>
        <Input
          id="max_slots"
          type="number"
          min={1}
          max={9999}
          value={form.max_slots}
          onChange={e => set("max_slots", Number(e.target.value))}
        />
      </div>

      {/* Obrigatório */}
      <div className="flex items-center gap-3">
        <Switch
          id="is_mandatory"
          checked={form.is_mandatory}
          onCheckedChange={v => set("is_mandatory", v)}
        />
        <Label htmlFor="is_mandatory" className="cursor-pointer">
          Participação obrigatória
        </Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || uploading}>
          {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
          {isEditing ? "Salvar alterações" : "Criar evento"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
