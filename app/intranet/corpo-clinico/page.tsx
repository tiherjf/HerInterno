"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, AlertTriangle, Clock, CalendarDays, Stethoscope,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, Wallet, Baby, SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";
import { AgendaEditor } from "@/components/corpo-clinico/AgendaEditor";
import { agendaDoDia, atendeNoDia, turnosDe, TURNO_LABEL, type Turno, type AgendaEntry } from "@/components/corpo-clinico/agenda";

// Chips do filtro de disponibilidade (multisseleção)
const DISPONIBILIDADE: { key: string; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "manha", label: TURNO_LABEL.manha },
  { key: "tarde", label: TURNO_LABEL.tarde },
  { key: "noite", label: TURNO_LABEL.noite },
];

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

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Monta o bloco compacto de valores, omitindo os que estão nulos. */
function blocoValores(p: Profissional): string[] {
  const partes: string[] = [];
  if (p.valor_particular != null) partes.push(`Particular ${BRL.format(p.valor_particular)}`);
  if (p.valor_convenio != null) partes.push(`Convênio ${BRL.format(p.valor_convenio)}`);
  if (p.valor_desconto != null) partes.push(`Desconto ${BRL.format(p.valor_desconto)}`);
  return partes;
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
  agenda?: AgendaEntry[] | null;
  valor_particular?: number | null;
  valor_convenio?: number | null;
  valor_desconto?: number | null;
  convenios?: string[] | null;
  idade_minima?: number | null;
  local?: string | null;
  subespecialidade?: string | null;
}

interface Grupo {
  nome: string;
  profissionais: Profissional[];
}

interface FormState {
  nome: string;
  especialidade: string;
  grupo: string;
  grupo_novo: string;
  unidade: UnidadeKey | string;
  dias: string;
  horarios: string;
  observacoes: string;
  sem_agenda: boolean;
  agenda: AgendaEntry[];
  valor_particular: number | null;
  valor_convenio: number | null;
  valor_desconto: number | null;
  convenios: string[];
  idade_minima: number | null;
  local: string;
  subespecialidade: string;
}

const EMPTY_FORM: FormState = {
  nome: "",
  especialidade: "",
  grupo: "",
  grupo_novo: "",
  unidade: "Clínica da Criança",
  dias: "",
  horarios: "",
  observacoes: "",
  sem_agenda: false,
  agenda: [],
  valor_particular: null,
  valor_convenio: null,
  valor_desconto: null,
  convenios: [],
  idade_minima: null,
  local: "",
  subespecialidade: "",
};

export default function CorpoClinicoPage() {
  const { canEdit: podeEditar } = useMenuPermission("corpo-clinico");

  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [grupoAtivo, setGrupoAtivo] = useState<string | null>(null);
  const [unidadeAtiva, setUnidadeAtiva] = useState<string | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<Set<string>>(new Set());
  const toggleDisponibilidade = (key: string) =>
    setDisponibilidade(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [aviso, setAviso] = useState("");

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

  // Convênios distintos já cadastrados (para o datalist do formulário)
  const conveniosExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const p of profissionais) for (const c of p.convenios ?? []) set.add(c);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [profissionais]);

  const gruposFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    const hoje = new Date().getDay();
    return grupos.filter(g => {
      if (grupoAtivo && g.nome !== grupoAtivo) return false;
      return true;
    }).map(g => ({
      ...g,
      profissionais: g.profissionais.filter(p => {
        if (unidadeAtiva && p.unidade !== unidadeAtiva) return false;
        if (disponibilidade.size > 0) {
          if (disponibilidade.has("hoje") && !atendeNoDia(p.agenda, p.dias, hoje)) return false;
          const turnosSel = Array.from(disponibilidade).filter(d => d !== "hoje") as Turno[];
          if (turnosSel.length > 0) {
            const ts = turnosDe(p.agenda, p.horarios);
            if (!turnosSel.some(t => ts.has(t))) return false;
          }
        }
        if (!termo) return true;
        return (
          p.nome.toLowerCase().includes(termo) ||
          p.especialidade.toLowerCase().includes(termo) ||
          p.dias.toLowerCase().includes(termo) ||
          p.unidade.toLowerCase().includes(termo) ||
          (p.subespecialidade?.toLowerCase().includes(termo) ?? false) ||
          (p.local?.toLowerCase().includes(termo) ?? false) ||
          (p.convenios?.some(c => c.toLowerCase().includes(termo)) ?? false)
        );
      }),
    })).filter(g => g.profissionais.length > 0);
  }, [busca, grupoAtivo, unidadeAtiva, disponibilidade, grupos]);

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
    // Editor trabalha com uma faixa por dia: mantém a primeira faixa de cada dia
    const porDia = new Map<number, AgendaEntry>();
    for (const e of Array.isArray(p.agenda) ? p.agenda : []) {
      if (!porDia.has(e.dia)) porDia.set(e.dia, e);
    }
    setForm({
      nome: p.nome,
      especialidade: p.especialidade,
      grupo: p.grupo,
      grupo_novo: "",
      unidade: p.unidade ?? "Clínica da Criança",
      dias: p.dias === "—" ? "" : p.dias,
      horarios: p.horarios === "—" ? "" : p.horarios,
      observacoes: p.observacoes ?? "",
      sem_agenda: p.sem_agenda,
      agenda: Array.from(porDia.values()).sort((a, b) => a.dia - b.dia),
      valor_particular: p.valor_particular ?? null,
      valor_convenio: p.valor_convenio ?? null,
      valor_desconto: p.valor_desconto ?? null,
      convenios: p.convenios ?? [],
      idade_minima: p.idade_minima ?? null,
      local: p.local ?? "",
      subespecialidade: p.subespecialidade ?? "",
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
    const temAgenda = !form.sem_agenda && form.agenda.length > 0;
    if (temAgenda) {
      const invalida = form.agenda.find(e => !e.inicio || !e.fim || e.inicio >= e.fim);
      if (invalida) {
        setFormError("Agenda: o horário de início deve ser antes do fim em todos os dias.");
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      const original = editingId ? profissionais.find(p => p.id === editingId) : undefined;
      const tinhaAgenda = Array.isArray(original?.agenda) && (original?.agenda?.length ?? 0) > 0;

      const body: Record<string, unknown> = {
        nome: form.nome.trim(),
        especialidade: form.especialidade.trim(),
        grupo: grupoFinal,
        unidade: form.unidade || "Clínica da Criança",
        observacoes: form.observacoes.trim() || null,
        sem_agenda: form.sem_agenda,
        // Valores & convênios (migração 045)
        valor_particular: form.valor_particular,
        valor_convenio: form.valor_convenio,
        valor_desconto: form.valor_desconto,
        convenios: form.convenios.map(c => c.trim()).filter(Boolean),
        idade_minima: form.idade_minima,
        local: form.local.trim() || null,
        subespecialidade: form.subespecialidade.trim() || null,
      };
      if (temAgenda) {
        // O servidor gera dias/horarios legíveis a partir da agenda
        body.agenda = form.agenda;
      } else {
        body.dias = form.sem_agenda ? "—" : (form.dias.trim() || "—");
        body.horarios = form.sem_agenda ? "—" : (form.horarios.trim() || "—");
        // Só limpa a coluna agenda se o registro tinha agenda estruturada
        if (tinhaAgenda) body.agenda = null;
      }

      const url = editingId ? `/api/corpo-clinico/${editingId}` : "/api/corpo-clinico";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        let msg = "Erro ao salvar.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch { /* resposta sem JSON */ }
        setFormError(msg);
        return;
      }
      const j = await res.json().catch(() => null);
      setAviso(j?.aviso ?? "");
      setShowForm(false);
      fetchProfissionais();
    } catch {
      setFormError("Falha de conexão ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Profissional) => {
    if (!confirm(`Remover "${p.nome}" do corpo clínico?`)) return;
    try {
      const res = await fetch(`/api/corpo-clinico/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        let msg = "Erro ao remover.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch { /* resposta sem JSON */ }
        alert(msg);
        return;
      }
      fetchProfissionais();
    } catch {
      alert("Falha de conexão ao remover. Tente novamente.");
    }
  };

  const f = (field: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const grupoFinalLabel = form.grupo === "__novo__" ? form.grupo_novo : form.grupo;
  const totalProfissionais = profissionais.length;
  const hoje = new Date().getDay();
  const filtrosAtivos = grupoAtivo !== null ? 1 : 0;

  // Registro em edição sem agenda estruturada, mas com textos legados de dias/horários
  const registroEmEdicao = editingId ? profissionais.find(p => p.id === editingId) : undefined;
  const legadoSemEstrutura = !!registroEmEdicao &&
    !(Array.isArray(registroEmEdicao.agenda) && registroEmEdicao.agenda.length > 0) &&
    Boolean(form.dias.trim() || form.horarios.trim());

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-primary rounded-xl p-5 text-primary-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Stethoscope size={26} className="shrink-0" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Corpo Clínico</h2>
              {!loading && (
                <p className="text-primary-foreground/70 text-sm">
                  {grupos.length} especialidades · {totalProfissionais} profissionais
                </p>
              )}
            </div>
          </div>
          {podeEditar && (
            <Button onClick={openCreate} className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 shrink-0 w-full sm:w-auto">
              <Plus size={15} /> Novo Profissional
            </Button>
          )}
        </div>
      </div>

      {/* Aviso de migração 045 pendente */}
      {aviso && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle size={15} className="text-amber-500" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{aviso}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-amber-800" onClick={() => setAviso("")}>
              Dispensar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Unidade — sempre visível */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unidade</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={unidadeAtiva === null ? "default" : "outline"}
            onClick={() => setUnidadeAtiva(null)}
            className="rounded-full text-xs h-7 px-3"
          >
            Todas as unidades
          </Button>
          {UNIDADES.map(u => (
            <Button
              key={u.key}
              size="sm"
              variant={unidadeAtiva === u.key ? "default" : "outline"}
              onClick={() => setUnidadeAtiva(unidadeAtiva === u.key ? null : u.key)}
              className="rounded-full text-xs h-7 px-3"
            >
              {u.emoji} {u.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Busca + botão de filtros */}
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
        <Button
          variant="outline"
          onClick={() => setFiltrosAbertos(v => !v)}
          className={`gap-2 shrink-0 ${filtrosAtivos > 0 ? "border-primary/40 text-primary" : ""}`}
        >
          <SlidersHorizontal size={15} /> Filtros
          {filtrosAtivos > 0 && (
            <Badge className="border-0 bg-primary text-primary-foreground h-5 min-w-5 justify-center px-1.5 text-[11px]">
              {filtrosAtivos}
            </Badge>
          )}
          {filtrosAbertos
            ? <ChevronUp size={15} className="text-muted-foreground" />
            : <ChevronDown size={15} className="text-muted-foreground" />}
        </Button>
      </div>

      {/* Disponibilidade — sempre visível, multisseleção */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Disponibilidade</p>
        <div className="flex flex-wrap gap-2">
          {DISPONIBILIDADE.map(d => {
            const ativo = disponibilidade.has(d.key);
            return (
              <Button
                key={d.key}
                variant="outline"
                size="sm"
                onClick={() => toggleDisponibilidade(d.key)}
                className={`rounded-full gap-1.5 h-7 text-xs px-3 ${
                  ativo
                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700 hover:text-white"
                    : "text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
                }`}
              >
                {d.key === "hoje" && <Clock size={13} />} {d.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Painel de filtros (colapsável) */}
      {filtrosAbertos && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
          {/* Grupos / especialidades */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Especialidade</p>
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
          </div>

        </div>
      )}

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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Profissional</TableHead>
                        <TableHead className="hidden md:table-cell">Unidade</TableHead>
                        <TableHead>Especialidade</TableHead>
                        <TableHead className="hidden md:table-cell">Dias</TableHead>
                        <TableHead className="hidden md:table-cell">Horários</TableHead>
                        <TableHead className="hidden lg:table-cell">Convênios</TableHead>
                        <TableHead className="hidden lg:table-cell">Observações</TableHead>
                        <TableHead>Valores</TableHead>
                        {podeEditar && (
                          <TableHead className="text-right">
                            <span className="sr-only">Ações</span>
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.profissionais.map(prof => {
                        const ud = unidadeInfo(prof.unidade);
                        const entradasHoje = agendaDoDia(prof.agenda, hoje);
                        const hojeAtende = atendeNoDia(prof.agenda, prof.dias, hoje);
                        const valores = blocoValores(prof);
                        const observacoesTexto = prof.sem_agenda ? "Não liberou horário" : prof.observacoes;
                        return (
                          <TableRow key={prof.id} className={prof.sem_agenda ? "bg-amber-50" : ""}>
                            {/* Profissional */}
                            <TableCell className="align-top">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-foreground">{prof.nome}</span>
                                <div className="flex flex-wrap items-center gap-1">
                                  {prof.sem_agenda && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                                  {prof.subespecialidade && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium shrink-0">
                                      {prof.subespecialidade}
                                    </Badge>
                                  )}
                                  {hojeAtende && (
                                    <Badge
                                      variant="outline"
                                      className="bg-green-50 text-green-700 border-green-300 text-[10px] px-1.5 py-0 font-semibold shrink-0"
                                    >
                                      {entradasHoje.length > 0
                                        ? `Hoje · ${entradasHoje.map(e => `${e.inicio}–${e.fim}`).join(" / ")}`
                                        : "Hoje"}
                                    </Badge>
                                  )}
                                  {prof.sem_agenda && (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 font-medium shrink-0"
                                    >
                                      sem agenda
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Unidade */}
                            <TableCell className="hidden md:table-cell align-top">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ud.cor}`}>
                                <span>{ud.emoji}</span>
                                <span>{ud.label}</span>
                              </span>
                            </TableCell>

                            {/* Especialidade */}
                            <TableCell className="align-top">{prof.especialidade}</TableCell>

                            {/* Dias */}
                            <TableCell className="hidden md:table-cell align-top text-sm">
                              {prof.sem_agenda ? "Sem agenda" : prof.dias}
                            </TableCell>

                            {/* Horários */}
                            <TableCell className="hidden md:table-cell align-top text-sm">
                              {prof.sem_agenda ? "—" : prof.horarios}
                            </TableCell>

                            {/* Convênios */}
                            <TableCell className="hidden lg:table-cell align-top">
                              {prof.convenios && prof.convenios.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {prof.convenios.map(c => (
                                    <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                                      {c}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* Observações (+ idade mínima + local) */}
                            <TableCell className="hidden lg:table-cell align-top">
                              <div className="flex flex-col gap-0.5 text-sm text-muted-foreground max-w-[16rem]">
                                {observacoesTexto && <span>{observacoesTexto}</span>}
                                {prof.idade_minima != null && (
                                  <span className="inline-flex items-center gap-1 text-xs text-sky-700">
                                    <Baby size={11} /> a partir de {prof.idade_minima} anos
                                  </span>
                                )}
                                {prof.local && <span className="text-xs">{prof.local}</span>}
                                {!observacoesTexto && prof.idade_minima == null && !prof.local && (
                                  <span>—</span>
                                )}
                              </div>
                            </TableCell>

                            {/* Valores */}
                            <TableCell className="align-top">
                              {valores.length > 0 ? (
                                <div className="flex items-start gap-1 text-xs font-medium text-emerald-700">
                                  <Wallet size={11} className="mt-0.5 shrink-0" />
                                  <div className="flex flex-col gap-0.5">
                                    {valores.map(v => <span key={v}>{v}</span>)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* Ações */}
                            {podeEditar && (
                              <TableCell className="align-top text-right whitespace-nowrap">
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
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                      {podeEditar && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="bg-gray-50 py-2">
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
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {legadoSemEstrutura && (
                  <div className="rounded-lg border bg-muted/50 px-3 py-2.5 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <CalendarDays size={12} /> Cadastro antigo (texto livre)
                    </p>
                    {form.dias.trim() && (
                      <p className="text-sm text-foreground"><strong>Dias:</strong> {form.dias}</p>
                    )}
                    {form.horarios.trim() && (
                      <p className="text-sm text-foreground"><strong>Horários:</strong> {form.horarios}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Ao salvar com a agenda estruturada abaixo, esses textos serão substituídos automaticamente.
                    </p>
                  </div>
                )}
                <AgendaEditor
                  value={form.agenda}
                  onChange={agenda => setForm(prev => ({ ...prev, agenda }))}
                />
              </>
            )}

            {/* Valores & Convênios */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Wallet size={14} /> Valores & Convênios
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Particular (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01" inputMode="decimal" placeholder="0,00"
                    value={form.valor_particular ?? ""}
                    onChange={e => setForm(prev => ({ ...prev, valor_particular: e.target.value === "" ? null : Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Convênio (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01" inputMode="decimal" placeholder="0,00"
                    value={form.valor_convenio ?? ""}
                    onChange={e => setForm(prev => ({ ...prev, valor_convenio: e.target.value === "" ? null : Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Desconto (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01" inputMode="decimal" placeholder="0,00"
                    value={form.valor_desconto ?? ""}
                    onChange={e => setForm(prev => ({ ...prev, valor_desconto: e.target.value === "" ? null : Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Convênios</Label>
                <Input
                  list="convenios-existentes"
                  placeholder="Ex: Unimed, Bradesco Saúde, Amil"
                  value={form.convenios.join(", ")}
                  onChange={e => setForm(prev => ({ ...prev, convenios: e.target.value.split(",").map(s => s.trimStart()) }))}
                />
                <datalist id="convenios-existentes">
                  {conveniosExistentes.map(c => <option key={c} value={c} />)}
                </datalist>
                <p className="text-xs text-muted-foreground">Separe vários convênios por vírgula.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Idade mínima</Label>
                  <Input
                    type="number" min={0} step={1} inputMode="numeric" placeholder="Ex: 12"
                    value={form.idade_minima ?? ""}
                    onChange={e => setForm(prev => ({ ...prev, idade_minima: e.target.value === "" ? null : Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio se todas as idades.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subespecialidade</Label>
                  <Input
                    placeholder="Joelho, Mastologista…"
                    value={form.subespecialidade}
                    onChange={f("subespecialidade")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Local</Label>
                <Input
                  placeholder="2º Andar · Ramal 4983"
                  value={form.local}
                  onChange={f("local")}
                />
              </div>
            </div>

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
