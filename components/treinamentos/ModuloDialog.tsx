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

interface ModuloData {
  id?: string;
  name?: string;
  description?: string | null;
  cover_url?: string | null;
  order_index?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: ModuloData;
}

export default function ModuloDialog({ open, onClose, onSaved, initial }: Props) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [order, setOrder] = useState(String(initial?.order_index ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    setError("");
    const url = isEdit ? `/api/treinamentos/modulos/${initial!.id}` : "/api/treinamentos/modulos";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, order_index: Number(order) }),
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
          <DialogTitle>{isEdit ? "Editar módulo" : "Novo módulo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Treinamento TOTVS" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Descrição breve do módulo..." />
          </div>
          <div className="space-y-1.5">
            <Label>Ordem de exibição</Label>
            <Input type="number" min={0} value={order} onChange={e => setOrder(e.target.value)} className="w-24" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
