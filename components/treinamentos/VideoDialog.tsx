"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { extractYouTubeId } from "@/lib/youtube";

interface VideoData {
  id?: string;
  title?: string;
  description?: string | null;
  youtube_id?: string;
  duration_minutes?: number | null;
  order_index?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  moduleId: string;
  initial?: VideoData;
}

export default function VideoDialog({ open, onClose, onSaved, moduleId, initial }: Props) {
  const isEdit = !!initial?.id;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtube_id ?? "");
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? ""));
  const [order, setOrder] = useState(String(initial?.order_index ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!title.trim()) { setError("Título é obrigatório."); return; }
    const ytId = extractYouTubeId(youtubeUrl);
    if (!ytId) { setError("URL ou ID do YouTube inválido."); return; }
    setSaving(true);
    setError("");

    const payload = {
      module_id: moduleId,
      title: title.trim(),
      description: description.trim() || null,
      youtube_id: ytId,
      duration_minutes: duration ? Number(duration) : null,
      order_index: Number(order),
    };

    const url = isEdit ? `/api/treinamentos/videos/${initial!.id}` : "/api/treinamentos/videos";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Erro ao salvar."); setSaving(false); return; }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar vídeo" : "Adicionar vídeo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Aula 1 – Introdução" />
          </div>
          <div className="space-y-1.5">
            <Label>URL ou ID do YouTube *</Label>
            <Input
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://youtu.be/... ou ID do vídeo"
            />
            <p className="text-xs text-muted-foreground">Cole a URL do YouTube (não listado) ou só o ID (ex: dQw4w9WgXcQ)</p>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Resumo do conteúdo..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duração (minutos)</Label>
              <Input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ex: 15" />
            </div>
            <div className="space-y-1.5">
              <Label>Ordem</Label>
              <Input type="number" min={0} value={order} onChange={e => setOrder(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            {isEdit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
