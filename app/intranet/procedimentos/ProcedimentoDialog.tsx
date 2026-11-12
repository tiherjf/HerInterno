"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagInput } from "@/components/ui-her/TagInput";
import type { Procedimento, TipoKey } from "@/lib/procedimentos/types";
import { FORM_PROC_VAZIO, formDeProcedimento, payloadProcedimento, validarFormProc, type FormProc } from "@/lib/procedimentos/form";
import { TIPOS, UNIDADES_PROC } from "./FiltrosProc";

type CampoTexto =
  | "nome" | "descricao" | "preparacao" | "categoria" | "unidade_medida" | "protocolo"
  | "documentos_necessarios" | "suspende_medicacao" | "dias" | "horarios";
type CampoNumero = "preco" | "parcelas_max" | "pacote_sessoes" | "pacote_preco" | "jejum_horas" | "duracao_min";

// Convênios e médicos ficam no formulário como texto "A, B" (a API divide);
// o campo de etiquetas converte na borda.
const paraLista = (t: string) => t.split(",").map((s) => s.trim()).filter(Boolean);
const paraTexto = (l: string[]) => l.join(", ");

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h3>
      {children}
    </section>
  );
}

/** Novo/editar procedimento. Envia exatamente o mesmo corpo da tela antiga (lib/procedimentos/form). */
export function ProcedimentoDialog({ aberto, original, unidadeInicial, categorias, convenios, medicos, onFechar, onSalvo }: {
  aberto: boolean;
  original?: Procedimento;
  unidadeInicial: string;
  categorias: string[];
  convenios: string[];
  medicos: string[];
  onFechar: () => void;
  onSalvo: (aviso: string) => void;
}) {
  const [form, setForm] = useState<FormProc>(FORM_PROC_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setForm(original ? formDeProcedimento(original) : { ...FORM_PROC_VAZIO, unidade: unidadeInicial });
    setErro("");
    setSalvando(false);
  }, [aberto, original, unidadeInicial]);

  const set = <K extends keyof FormProc>(k: K, v: FormProc[K]) => setForm((f) => ({ ...f, [k]: v }));
  const texto = (k: CampoTexto) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value);
  const numero = (k: CampoNumero) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, e.target.value === "" ? null : Number(e.target.value));

  async function salvar() {
    const msg = validarFormProc(form);
    if (msg) { setErro(msg); return; }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(original ? `/api/procedimentos/${original.id}` : "/api/procedimentos", {
        method: original ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadProcedimento(form)),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(j.error ?? "Erro ao salvar."); return; }
      onSalvo(j.aviso ?? "");
      onFechar();
    } catch {
      setErro("Falha de conexão ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = (id: string, rotulo: string, input: ReactNode, ajuda?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {input}
      {ajuda && <p className="text-[11px] text-slate-500">{ajuda}</p>}
    </div>
  );

  const reais = (id: string, k: "preco" | "pacote_preco") => (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input id={id} type="number" min="0" step="0.01" placeholder="0,00" className="pl-9" value={form[k] ?? ""} onChange={numero(k)} />
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{original ? "Editar item" : "Novo procedimento / exame"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Secao titulo="Identificação">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v as TipoKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t.key} value={t.key}>{t.singular}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidade *</Label>
                <Select value={form.unidade} onValueChange={(v) => set("unidade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_PROC.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                {campo("p-nome", "Nome *", <Input id="p-nome" placeholder="Ex: Hemograma completo, Ressonância magnética..." value={form.nome} onChange={texto("nome")} />)}
              </div>
              {campo("p-cat", "Categoria", (
                <>
                  <Input id="p-cat" list="p-categorias" placeholder="Ex: Peeling, Toxina botulínica..." value={form.categoria} onChange={texto("categoria")} />
                  <datalist id="p-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                </>
              ))}
              {campo("p-dur", "Duração (min)", <Input id="p-dur" type="number" min="0" step="1" placeholder="30" value={form.duracao_min ?? ""} onChange={numero("duracao_min")} />)}
            </div>
          </Secao>

          <Secao titulo="Valores & pagamento">
            <div className="grid gap-3 sm:grid-cols-3">
              {campo("p-preco", "Preço", reais("p-preco", "preco"))}
              {campo("p-medida", "Unidade de medida", <Input id="p-medida" placeholder="sessão, ampola, frasco…" value={form.unidade_medida} onChange={texto("unidade_medida")} />)}
              {campo("p-parc", "Parcelas máx.", <Input id="p-parc" type="number" min="0" step="1" placeholder="6" value={form.parcelas_max ?? ""} onChange={numero("parcelas_max")} />)}
              {campo("p-ses", "Pacote: sessões", <Input id="p-ses" type="number" min="0" step="1" placeholder="3" value={form.pacote_sessoes ?? ""} onChange={numero("pacote_sessoes")} />)}
              {campo("p-pac", "Preço do pacote", reais("p-pac", "pacote_preco"))}
              {campo("p-prot", "Protocolo (texto livre)", <Input id="p-prot" placeholder="Protocolo 3 sessões: R$ 1.200,00" value={form.protocolo} onChange={texto("protocolo")} />)}
            </div>
          </Secao>

          <Secao titulo="Dias & horários">
            <div className="grid gap-3 sm:grid-cols-2">
              {campo("p-dias", "Dias", <Input id="p-dias" placeholder="Seg a Sex" value={form.dias} onChange={texto("dias")} />)}
              {campo("p-hor", "Horários", <Input id="p-hor" placeholder="08:00–17:00" value={form.horarios} onChange={texto("horarios")} />)}
            </div>
          </Secao>

          <Secao titulo="Preparo">
            <div className="grid gap-3 sm:grid-cols-2">
              {campo("p-jejum", "Jejum (horas)", <Input id="p-jejum" type="number" min="0" step="1" placeholder="8" value={form.jejum_horas ?? ""} onChange={numero("jejum_horas")} />, "0 = sem jejum")}
              <label className="flex cursor-pointer items-center gap-2 sm:pt-6">
                <Checkbox checked={form.requer_agendamento} onCheckedChange={(v) => set("requer_agendamento", v === true)} />
                <span className="text-sm">Requer agendamento</span>
              </label>
            </div>
            {campo("p-docs", "Documentos necessários", <Input id="p-docs" placeholder="Ex: Pedido médico, RG, carteirinha do convênio…" value={form.documentos_necessarios} onChange={texto("documentos_necessarios")} />)}
            {campo("p-susp", "Suspender medicação", <Input id="p-susp" placeholder="Ex: Suspender anticoagulante 3 dias antes…" value={form.suspende_medicacao} onChange={texto("suspende_medicacao")} />)}
            <div className="space-y-1.5">
              <Label htmlFor="p-prep" className="flex items-center gap-1">
                <AlertCircle size={13} className="text-amber-600" /> Observações de preparo
              </Label>
              <Textarea
                id="p-prep" rows={3}
                placeholder="Instruções de preparo que o paciente deve seguir antes do exame..."
                value={form.preparacao} onChange={texto("preparacao")}
                className="resize-none border-amber-200 bg-amber-50/60"
              />
              <p className="text-xs text-slate-500">Deixe em branco se não há preparo especial.</p>
            </div>
          </Secao>

          <Secao titulo="Convênios & médicos">
            <div className="space-y-1.5">
              <Label htmlFor="p-conv">Convênios</Label>
              <TagInput id="p-conv" value={paraLista(form.convenios)} onChange={(l) => set("convenios", paraTexto(l))} sugestoes={convenios} placeholder="Ex: Unimed, Bradesco, SulAmérica" />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={form.atende_particular} onCheckedChange={(v) => set("atende_particular", v === true)} />
              <span className="text-sm">Atende particular</span>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="p-med">Médicos</Label>
              <TagInput id="p-med" value={paraLista(form.medicos)} onChange={(l) => set("medicos", paraTexto(l))} sugestoes={medicos} placeholder="Ex: Dra. Thais, Dra. Jessica" />
            </div>
          </Secao>

          <Secao titulo="Descrição">
            <Textarea
              rows={2}
              placeholder="Informações gerais sobre o exame ou procedimento..."
              value={form.descricao}
              onChange={texto("descricao")}
              className="resize-none"
              aria-label="Descrição"
            />
          </Secao>

          {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 size={14} className="mr-2 animate-spin" />}
            {salvando ? "Salvando..." : original ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
