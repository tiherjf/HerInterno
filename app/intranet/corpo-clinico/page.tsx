"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, AlertTriangle, Clock, CalendarDays, Stethoscope,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";

const UNIDADES = [
  { key: "Hospital",           label: "Hospital",            emoji: "🏥", cor: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "Clínica da Criança", label: "Clínica da Criança",  emoji: "👶", cor: "bg-pink-100 text-pink-800 border-pink-200" },
  { key: "Levy",               label: "Instituto Levy",      emoji: "🏛️", cor: "bg-purple-100 text-purple-800 border-purple-200" },
  { key: "Barão",              label: "Barão",               emoji: "🏢", cor: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "Instituto",          label: "Instituto",           emoji: "🔬", cor: "bg-green-100 text-green-800 border-green-200" },
] as const;

type UnidadeKey = typeof UNIDADES[number]["key"];

function unidadeInfo(key: string) {
  return UNIDADES.find(u => u.key === key) ?? { label: key, emoji: "🏥", cor: "bg-gray-100 text-gray-700 border-gray-200" };
}

interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  grupo: string;
  unidade: string;
  dias: string;
  horarios: string;
  observacoes?: string | null;
  sem_agenda: boolean;
}

interface Grupo {
  nome: string;
  profissionais: Profissional[];
}

const EMPTY_FORM = {
  nome: "",
  especialidade: "",
  grupo: "",
  grupo_novo: "",
  unidade: "Hospital" as UnidadeKey | string,
  dias: "",
  horarios: "",
  observacoes: "",
  sem_agenda: false,
};

export default function CorpoClinicoPage() {
  const { canEdit: podeEditar } = useMenuPermission("corpo-clinico");

  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [grupoAtivo, setGrupoAtivo] = useState<string | null>(null);
  const [unidadeAtiva, setUnidadeAtiva] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchProfissionais = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/corpo-clinico");
      const json = await res.json();
      const lista: Profissional[] = json.profissionais ?? [];
      setProfissionais(lista);
      setExpandidos(new Set(lista.map((p: Profissional) => p.grupo)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfissionais(); }, [fetchProfissionais]);

  const grupos: Grupo[] = useMemo(() => {
    const map = new Map<string, Profissional[]>();
    for (const p of profissionais) {
      if (!map.has(p.grupo)) map.set(p.grupo, []);
      map.get(p.grupo)!.push(p);
    }
    return Array.from(map.entries()).map(([nome, profs]) => ({ nome, profissionais: profs }));
  }, [profissionais]);

  const nomesGrupos = useMemo(() => grupos.map(g => g.nome), [grupos]);

  const gruposFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return grupos.filter(g => {
      if (grupoAtivo && g.nome !== grupoAtivo) return false;
      return true;
    }).map(g => ({
      ...g,
      profissionais: g.profissionais.filter(p => {
        if (unidadeAtiva && p.unidade !== unidadeAtiva) return false;
        if (!termo) return true;
        return (
          p.nome.toLowerCase().includes(termo) ||
          p.especialidade.toLowerCase().includes(termo) ||
          p.dias.toLowerCase().includes(termo) ||
          p.unidade.toLowerCase().includes(termo)
        );
      }),
    })).filter(g => g.profissionais.length > 0);
  }, [busca, grupoAtivo, unidadeAtiva, grupos]);

  const toggleExpandido = (nome: string) => {
    setExpandidos(prev => {
      const s = new Set(prev);
      if (s.has(nome)) s.delete(nome); else s.add(nome);
      return s;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (p: Profissional) => {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      especialidade: p.especialidade,
      grupo: p.grupo,
      grupo_novo: "",
      unidade: p.unidade ?? "Hospital",
      dias: p.dias === "—" ? "" : p.dias,
      horarios: p.horarios === "—" ? "" : p.horarios,
      observacoes: p.observacoes ?? "",
      sem_agenda: p.sem_agenda,
    });
    setFormError("");
    setShowForm(true);
  };

  const save = async () => {
    const grupoFinal = form.grupo === "__novo__" ? form.grupo_novo.trim() : form.grupo;
    if (!form.nome.trim() || !form.especialidade.trim() || !grupoFinal) {
      setFormError("Nome, especialidade e grupo são obrigatórios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        nome: form.nome.trim(),
        especialidade: form.especialidade.trim(),
        grupo: grupoFinal,
        unidade: form.unidade || "Hospital",
        dias: form.sem_agenda ? "—" : (form.dias.trim() || "—"),
        horarios: form.sem_agenda ? "—" : (form.horarios.trim() || "—"),
        observacoes: form.observacoes.trim() || null,
        sem_agenda: form.sem_agenda,
      };
      const url = editingId ? `/api/corpo-clinico/${editingId}` : "/api/corpo-clinico";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json();
        setFormError(j.error ?? "Erro ao salvar.");
        return;
      }
      setShowForm(false);
      fetchProfissionais();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Profissional) => {
    if (!confirm(`Remover "${p.nome}" do corpo clínico?`)) return;
    await fetch(`/api/corpo-clinico/${p.id}`, { method: "DELETE" });
    fetchProfissionais();
  };

  const f = (field: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const grupoFinalLabel = form.grupo === "__novo__" ? form.grupo_novo : form.grupo;
  const totalProfissionais = profissionais.length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-primary rounded-xl p-5 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Stethoscope size={26} />
            <div>
              <h2 className="text-xl font-bold">Corpo Clínico</h2>
              {!loading && (
                <p className="text-primary-foreground/70 text-sm">
                  {grupos.length} especialidades · {totalProfissionais} profissionais
                </p>
              )}
            </div>
          </div>
          {podeEditar && (
            <Button onClick={openCreate} className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 shrink-0">
              <Plus size={15} /> Novo Profissional
            </Button>
          )}
        </div>

        {/* Chips de unidade no cabeçalho */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            size="sm"
            onClick={() => setUnidadeAtiva(null)}
            className={`rounded-full text-xs h-7 px-3 ${
              unidadeAtiva === null
                ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-primary-foreground"
                : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-primary-foreground/40"
            }`}
            variant="outline"
          >
            Todas as unidades
          </Button>
          {UNIDADES.map(u => (
            <Button
              key={u.key}
              size="sm"
              onClick={() => setUnidadeAtiva(unidadeAtiva === u.key ? null : u.key)}
              className={`rounded-full text-xs h-7 px-3 ${
                unidadeAtiva === u.key
                  ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-primary-foreground"
                  : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-primary-foreground/40"
              }`}
              variant="outline"
            >
              {u.emoji} {u.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, especialidade, unidade ou dia..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Chips de especialidade */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={grupoAtivo === null ? "default" : "outline"}
          onClick={() => setGrupoAtivo(null)}
          className="rounded-full text-xs h-7"
        >
          Todas ({grupos.length})
        </Button>
        {grupos.map(g => (
          <Button
            key={g.nome}
            size="sm"
            variant={grupoAtivo === g.nome ? "default" : "outline"}
            onClick={() => setGrupoAtivo(grupoAtivo === g.nome ? null : g.nome)}
            className="rounded-full text-xs h-7"
          >
            {g.nome} ({g.profissionais.length})
          </Button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {!loading && gruposFiltrados.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Stethoscope size={32} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum profissional encontrado{busca ? ` para "${busca}"` : ""}.</p>
          </CardContent>
        </Card>
      )}

      {!loading && (
        <div className="space-y-4">
          {gruposFiltrados.map(g => (
            <Card key={g.nome} className="overflow-hidden">
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between px-5 py-4 bg-muted hover:bg-muted/80 transition-colors text-left h-auto rounded-none"
                onClick={() => toggleExpandido(g.nome)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground text-base">{g.nome}</span>
                  <Badge variant="secondary" className="text-xs">
                    {g.profissionais.length} profissional{g.profissionais.length !== 1 ? "is" : ""}
                  </Badge>
                  {g.profissionais.some(p => p.sem_agenda) && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <AlertTriangle size={13} />
                      {g.profissionais.filter(p => p.sem_agenda).length} sem agenda
                    </span>
                  )}
                </div>
                {expandidos.has(g.nome)
                  ? <ChevronUp size={18} className="text-gray-400 shrink-0" />
                  : <ChevronDown size={18} className="text-gray-400 shrink-0" />
                }
              </Button>

              {expandidos.has(g.nome) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-5 py-2.5 font-medium">Profissional</th>
                        <th className="text-left px-5 py-2.5 font-medium hidden sm:table-cell">Unidade</th>
                        <th className="text-left px-5 py-2.5 font-medium hidden md:table-cell">Especialidade</th>
                        <th className="text-left px-5 py-2.5 font-medium">
                          <span className="flex items-center gap-1"><CalendarDays size={12} /> Dias</span>
                        </th>
                        <th className="text-left px-5 py-2.5 font-medium hidden lg:table-cell">
                          <span className="flex items-center gap-1"><Clock size={12} /> Horários</span>
                        </th>
                        <th className="text-left px-5 py-2.5 font-medium hidden xl:table-cell">Observações</th>
                        {podeEditar && <th className="text-right px-5 py-2.5 font-medium">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {g.profissionais.map(prof => {
                        const ud = unidadeInfo(prof.unidade);
                        return (
                          <tr
                            key={prof.id}
                            className={`border-b last:border-0 transition-colors ${
                              prof.sem_agenda ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-5 py-3 font-medium text-gray-800">
                              <div className="flex items-center gap-2">
                                {prof.sem_agenda && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                                {prof.nome}
                              </div>
                              <div className="sm:hidden mt-1">
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${ud.cor}`}>
                                  {ud.emoji} {ud.label}
                                </span>
                              </div>
                              <div className="md:hidden text-xs text-muted-foreground mt-0.5">{prof.especialidade}</div>
                              <div className="lg:hidden text-xs text-muted-foreground mt-0.5">
                                {prof.sem_agenda
                                  ? <span className="text-amber-600">Sem agenda cadastrada</span>
                                  : prof.horarios}
                              </div>
                            </td>
                            <td className="px-5 py-3 hidden sm:table-cell">
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${ud.cor}`}>
                                {ud.emoji} {ud.label}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{prof.especialidade}</td>
                            <td className="px-5 py-3 text-gray-700">
                              {prof.sem_agenda
                                ? <span className="text-amber-600 text-xs font-medium">Sem agenda</span>
                                : prof.dias}
                            </td>
                            <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{prof.horarios}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs hidden xl:table-cell">
                              {prof.sem_agenda
                                ? <span className="text-amber-600 font-medium">Não liberou horário</span>
                                : (prof.observacoes || "—")}
                            </td>
                            {podeEditar && (
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => openEdit(prof)}>
                                    <Pencil size={14} />
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost"
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => remove(prof)}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {podeEditar && (
                        <tr className="border-t bg-gray-50">
                          <td colSpan={podeEditar ? 7 : 6} className="px-5 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-blue-600 hover:text-blue-800 h-7 px-2"
                              onClick={() => {
                                setEditingId(null);
                                setForm({ ...EMPTY_FORM, grupo: g.nome });
                                setFormError("");
                                setShowForm(true);
                              }}
                            >
                              <Plus size={12} /> Adicionar em {g.nome}
                            </Button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
        <span>Profissionais marcados em amarelo ainda não liberaram seus horários de atendimento.</span>
      </div>

      {/* Modal formulário */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Profissional" : "Novo Profissional"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input placeholder="Ex: João da Silva" value={form.nome} onChange={f("nome")} />
            </div>

            <div className="space-y-1.5">
              <Label>Especialidade *</Label>
              <Input placeholder="Ex: Pediatra, Otorrinolaringologista" value={form.especialidade} onChange={f("especialidade")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Grupo */}
              <div className="space-y-1.5">
                <Label>Grupo / Área *</Label>
                <Select value={form.grupo} onValueChange={v => setForm(prev => ({ ...prev, grupo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {nomesGrupos.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    <SelectItem value="__novo__">+ Criar novo grupo</SelectItem>
                  </SelectContent>
                </Select>
                {form.grupo === "__novo__" && (
                  <Input className="mt-2" placeholder="Nome do novo grupo" value={form.grupo_novo} onChange={f("grupo_novo")} />
                )}
                {grupoFinalLabel && (
                  <p className="text-xs text-muted-foreground">Grupo: <strong>{grupoFinalLabel}</strong></p>
                )}
              </div>

              {/* Unidade */}
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={v => setForm(prev => ({ ...prev, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map(u => (
                      <SelectItem key={u.key} value={u.key}>{u.emoji} {u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="sem_agenda"
                checked={form.sem_agenda}
                onCheckedChange={v => setForm(prev => ({ ...prev, sem_agenda: v === true }))}
                className="border-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <Label htmlFor="sem_agenda" className="text-amber-700 font-medium cursor-pointer">
                Profissional ainda não liberou horário
              </Label>
            </div>

            {!form.sem_agenda && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><CalendarDays size={13} /> Dias de atendimento</Label>
                  <Input placeholder="Ex: Segunda e Quarta / Sexta-feira" value={form.dias} onChange={f("dias")} />
                  <p className="text-xs text-muted-foreground">Use &quot; / &quot; para separar diferentes turnos</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Clock size={13} /> Horários</Label>
                  <Input placeholder="Ex: 09:00 às 13:00 / 14:00 às 17:00" value={form.horarios} onChange={f("horarios")} />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                placeholder="Informações adicionais, restrições de agenda..."
                value={form.observacoes}
                onChange={f("observacoes")}
                className="resize-none"
              />
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
