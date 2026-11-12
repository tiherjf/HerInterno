"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RamalSetor } from "@/lib/ramais/server";

/** Novo/editar setor. Ícone e cor não aparecem mais na tela: o formulário não os envia (o PATCH preserva os gravados). */
export function SetorDialog({ aberto, original, onFechar, onSalvo }: {
  aberto: boolean;
  original?: RamalSetor;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setNome(original?.name ?? "");
    setOrdem(String(original?.order_index ?? 0));
    setErro("");
    setSalvando(false);
  }, [aberto, original]);

  async function salvar() {
    if (!nome.trim()) { setErro("Nome obrigatório."); return; }
    setSalvando(true);
    try {
      const res = await fetch(original ? `/api/ramais/setores/${original.id}` : "/api/ramais/setores", {
        method: original ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome, order_index: Number(ordem) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(json.error ?? "Erro."); return; }
      onSalvo();
      onFechar();
    } catch {
      setErro("Falha de conexão ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
        <DialogHeader><DialogTitle>{original ? "Editar setor" : "Novo setor"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="setor-nome">Nome *</Label>
            <Input id="setor-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Térreo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setor-ordem">Ordem</Label>
            <Input id="setor-ordem" type="number" min={0} value={ordem} onChange={(e) => setOrdem(e.target.value)} className="w-24" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 size={14} className="mr-2 animate-spin" />}
            {original ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
