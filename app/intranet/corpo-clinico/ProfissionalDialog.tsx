"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgendaEditor } from "@/components/corpo-clinico/AgendaEditor";
import { TagInput } from "@/components/ui-her/TagInput";
import type { Profissional } from "@/lib/corpo-clinico/types";
import {
  FORM_CC_VAZIO, GRUPO_NOVO, formDeProfissional, grupoFinal, legadoSemEstrutura, payloadProfissional, validarFormCC,
  type FormCC,
} from "@/lib/corpo-clinico/form";
import { UNIDADES_CC } from "./FiltrosCC";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h3>
      {children}
    </section>
  );
}

function CampoValor({ id, rotulo, value, onChange }: { id: string; rotulo: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{rotulo}</Label>
      <Input
        id={id} type="number" min={0} step="0.01" inputMode="decimal" placeholder="0,00"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}

/** Novo/editar profissional. Envia exatamente o mesmo corpo da tela antiga (lib/corpo-clinico/form). */
export function ProfissionalDialog({ aberto, original, grupoInicial, grupos, convenios, onFechar, onSalvo }: {
  aberto: boolean;
  original?: Profissional;
  grupoInicial?: string;
  grupos: string[];
  convenios: string[];
  onFechar: () => void;
  onSalvo: (aviso: string) => void;
}) {
  const [form, setForm] = useState<FormCC>(FORM_CC_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setForm(original ? formDeProfissional(original) : { ...FORM_CC_VAZIO, grupo: grupoInicial ?? "" });
    setErro("");
    setSalvando(false);
  }, [aberto, original, grupoInicial]);

  const set = <K extends keyof FormCC>(k: K, v: FormCC[K]) => setForm((f) => ({ ...f, [k]: v }));
  const texto = (k: "nome" | "especialidade" | "grupo_novo" | "subespecialidade" | "local" | "observacoes") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value);

  async function salvar() {
    const msg = validarFormCC(form);
    if (msg) { setErro(msg); return; }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(original ? `/api/corpo-clinico/${original.id}` : "/api/corpo-clinico", {
        method: original ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadProfissional(form, original)),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErro(j?.error ?? "Erro ao salvar."); return; }
      onSalvo(j?.aviso ?? "");
      onFechar();
    } catch {
      setErro("Falha de conexão ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const grupoEscolhido = grupoFinal(form);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{original ? "Editar profissional" : "Novo profissional"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Secao titulo="Identificação">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cc-nome">Nome completo *</Label>
                <Input id="cc-nome" placeholder="Ex: João da Silva" value={form.nome} onChange={texto("nome")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-esp">Especialidade *</Label>
                <Input id="cc-esp" placeholder="Ex: Pediatra, Otorrinolaringologista" value={form.especialidade} onChange={texto("especialidade")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-sub">Subespecialidade</Label>
                <Input id="cc-sub" placeholder="Joelho, Mastologista…" value={form.subespecialidade} onChange={texto("subespecialidade")} />
              </div>
              <div className="space-y-1.5">
                <Label>Grupo / Área *</Label>
                <Select value={form.grupo} onValueChange={(v) => set("grupo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    <SelectItem value={GRUPO_NOVO}>+ Criar novo grupo</SelectItem>
                  </SelectContent>
                </Select>
                {form.grupo === GRUPO_NOVO && (
                  <Input className="mt-2" placeholder="Nome do novo grupo" value={form.grupo_novo} onChange={texto("grupo_novo")} aria-label="Nome do novo grupo" />
                )}
                {grupoEscolhido && <p className="text-xs text-slate-500">Grupo: <strong>{grupoEscolhido}</strong></p>}
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={(v) => set("unidade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_CC.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Secao>

          <Secao titulo="Agenda">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={form.sem_agenda}
                onCheckedChange={(v) => set("sem_agenda", v === true)}
                className="border-amber-600 data-[state=checked]:border-amber-600 data-[state=checked]:bg-amber-600"
              />
              <span className="text-sm font-medium text-amber-700">Ainda não liberou horário</span>
            </label>
            {!form.sem_agenda && (
              <>
                {legadoSemEstrutura(original, form) && (
                  <div className="space-y-1 rounded-lg border bg-slate-50 px-3 py-2.5">
                    <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      <CalendarDays size={12} /> Cadastro antigo (texto livre)
                    </p>
                    {form.dias.trim() && <p className="text-sm"><strong>Dias:</strong> {form.dias}</p>}
                    {form.horarios.trim() && <p className="text-sm"><strong>Horários:</strong> {form.horarios}</p>}
                    <p className="text-xs text-slate-500">
                      Ao salvar com a agenda estruturada abaixo, esses textos serão substituídos automaticamente.
                    </p>
                  </div>
                )}
                <AgendaEditor value={form.agenda} onChange={(agenda) => set("agenda", agenda)} />
              </>
            )}
          </Secao>

          <Secao titulo="Valores">
            <div className="grid gap-3 sm:grid-cols-3">
              <CampoValor id="cc-vp" rotulo="Consulta particular (R$)" value={form.valor_particular} onChange={(v) => set("valor_particular", v)} />
              <CampoValor id="cc-vc" rotulo="Pequenos convênios (R$)" value={form.valor_convenio} onChange={(v) => set("valor_convenio", v)} />
              <CampoValor id="cc-vd" rotulo="Particular com desconto (R$)" value={form.valor_desconto} onChange={(v) => set("valor_desconto", v)} />
            </div>
          </Secao>

          <Secao titulo="Convênios">
            <TagInput
              id="cc-convenios"
              value={form.convenios}
              onChange={(v) => set("convenios", v)}
              sugestoes={convenios}
              placeholder="Digite e tecle Enter (ex.: UNIMED JF)"
            />
            <p className="text-xs text-slate-500">Enter ou vírgula adiciona; colar &quot;A, B, C&quot; adiciona os três.</p>
          </Secao>

          <Secao titulo="Atendimento">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cc-idade" className="text-xs">Idade mínima</Label>
                <Input
                  id="cc-idade" type="number" min={0} step={1} inputMode="numeric" placeholder="Ex: 12"
                  value={form.idade_minima ?? ""}
                  onChange={(e) => set("idade_minima", e.target.value === "" ? null : Number(e.target.value))}
                />
                <p className="text-xs text-slate-500">Deixe vazio se todas as idades.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-local" className="text-xs">Local</Label>
                <Input id="cc-local" placeholder="2º Andar · Ramal 4983" value={form.local} onChange={texto("local")} />
              </div>
            </div>
          </Secao>

          <Secao titulo="Observações">
            <Textarea
              rows={2}
              placeholder="Informações adicionais, restrições de agenda..."
              value={form.observacoes}
              onChange={texto("observacoes")}
              className="resize-none"
              aria-label="Observações"
            />
          </Secao>

          {erro && (
            <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>
          )}
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
