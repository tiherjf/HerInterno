"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const MIN_MOTIVO = 5;
export const MAX_MOTIVO = 300;

/** Chamada urgente para quem está "Ocupado": pede o motivo (5–300 caracteres). */
export function DialogoUrgente({ aberto, primeiroNome, enviando, onCancelar, onConfirmar }: {
  aberto: boolean;
  primeiroNome: string;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (aberto) setMotivo(""); }, [aberto]);
  const valido = motivo.trim().length >= MIN_MOTIVO;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !enviando && onCancelar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600" /> Chamada urgente
          </DialogTitle>
          <DialogDescription>
            {primeiroNome} está com status ocupado. A mensagem será entregue com destaque de urgência e o
            motivo ficará registrado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="motivo-urgente" className="text-xs font-medium text-slate-600">
            Motivo da urgência (mínimo {MIN_MOTIVO} caracteres)
          </label>
          <Input
            id="motivo-urgente"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MAX_MOTIVO}
            placeholder="Ex.: paciente aguardando liberação..."
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && valido && !enviando) onConfirmar(motivo.trim()); }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
          <Button variant="destructive" onClick={() => onConfirmar(motivo.trim())} disabled={enviando || !valido}>
            {enviando && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Enviar urgente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
