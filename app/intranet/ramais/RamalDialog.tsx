"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RamalItem, RamalSetor } from "@/lib/ramais/server";

/** Adicionar/editar ramal. Payload igual ao de antes: setor_id, numero, descricao, order_index. */
export function RamalDialog({ aberto, original, setorInicial, setores, onFechar, onSalvo }: {
  aberto: boolean;
  original?: RamalItem;
  setorInicial?: string;
  setores: RamalSetor[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [numero, setNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [setorId, setSetorId] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setNumero(original?.numero ?? "");
    setDescricao(original?.descricao ?? "");
    setSetorId(original?.setor_id ?? setorInicial ?? "");
    setOrdem(String(original?.order_index ?? 0));
    setErro("");
    setSalvando(false);
  }, [aberto, original, setorInicial]);

  async function salvar() {
    if (!numero.trim() || !descricao.trim() || !setorId) {
      setErro("Todos os campos são obrigatórios.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(original ? `/api/ramais/itens/${original.id}` : "/api/ramais/itens", {
        method: original ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setor_id: setorId, numero, descricao, order_index: Number(ordem) }),
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
        <DialogHeader><DialogTitle>{original ? "Editar ramal" : "Adicionar ramal"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="space-y-1.5">
            <Label>Setor *</Label>
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ramal-numero">Número do ramal *</Label>
            <Input id="ramal-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 4936" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ramal-descricao">Descrição *</Label>
            <Input id="ramal-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: TI (Alexandre, Gabriel, Mateus)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ramal-ordem">Ordem</Label>
            <Input id="ramal-ordem" type="number" min={0} value={ordem} onChange={(e) => setOrdem(e.target.value)} className="w-24" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 size={14} className="mr-2 animate-spin" />}
            {original ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
