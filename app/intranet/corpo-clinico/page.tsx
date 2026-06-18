"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, AlertTriangle, Clock, CalendarDays, Stethoscope,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";

interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  grupo: string;
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
      // Expandir todos os grupos inicialmente
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
      if (!termo) return true;
      if (g.nome.toLowerCase().includes(termo)) return true;
      return g.profissionais.some(
        p => p.nome.toLowerCase().includes(termo) ||
             p.especialidade.toLowerCase().includes(termo) ||
             p.dias.toLowerCase().includes(termo)
      );
    }).map(g => ({
      ...g,
      profissionais: termo
        ? g.profissionais.filter(
            p => p.nome.toLowerCase().includes(termo) ||
                 p.especialidade.toLowerCase().includes(termo) ||
                 p.dias.toLowerCase().includes(termo)
          )
        : g.profissionais,
    }));
  }, [busca, grupoAtivo, grupos]);

  const toggleExpandido = (nome: string) => {
    setExpandidos(prev => {
      const s = new Set(prev);
      if (s.has(nome)) s.delete(nome);
      else s.add(nome);
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
        dias: form.sem_agenda ? "—" : (form.dias.trim() || "—"),
        horarios: form.sem_agenda ? "—" : (form.horarios.trim() || "—"),
        observacoes: form.observacoes.trim() || null,
        sem_agenda: form.sem_agenda,
      };
      const url = editingId ? `/api/corpo-clinico/${editingId}` : "/api/corpo-clinico";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Stethoscope size={28} />
            <div>
              <h2 className="text-2xl font-bold">Corpo Clínico por Especialidade</h2>
              {!loading && (
                <p className="text-blue-100 text-sm">
                  Clínica da Criança — {grupos.length} especialidades · {profissionais.length} profissionais
                </p>
              )}
            </div>
          </div>
          {podeEditar && (
            <Button
              onClick={openCreate}
              className="bg-white text-[#1e40af] hover:bg-blue-50 gap-2 shrink-0"
            >
              <Plus size={16} /> Novo Profissional
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, especialidade ou dia..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Chips de grupo */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setGrupoAtivo(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            grupoAtivo === null
              ? "bg-[#1e40af] text-white border-[#1e40af]"
              : "bg-white text-gray-600 border-gray-300 hover:border-[#1e40af] hover:text-[#1e40af]"
          }`}
        >
          Todas ({grupos.length})
        </button>
        {grupos.map(g => (
          <button
            key={g.nome}
            onClick={() => setGrupoAtivo(grupoAtivo === g.nome ? null : g.nome)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              grupoAtivo === g.nome
                ? "bg-[#1e40af] text-white border-[#1e40af]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#1e40af] hover:text-[#1e40af]"
            }`}
          >
            {g.nome} ({g.profissionais.length})
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {/* Resultados */}
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
              {/* Cabeçalho do grupo */}
              <button
                className="w-full flex items-center justify-between px-5 py-4 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                onClick={() => toggleExpandido(g.nome)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[#1e40af] text-base">{g.nome}</span>
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
              </button>

              {/* Tabela de profissionais */}
              {expandidos.has(g.nome) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-5 py-2.5 font-medium">Profissional</th>
                        <th className="text-left px-5 py-2.5 font-medium hidden md:table-cell">Especialidade</th>
                        <th className="text-left px-5 py-2.5 font-medium">
                          <span className="flex items-center gap-1"><CalendarDays size={12} /> Dias</span>
                        </th>
                        <th className="text-left px-5 py-2.5 font-medium hidden lg:table-cell">
                          <span className="flex items-center gap-1"><Clock size={12} /> Horários</span>
                        </th>
                        <th className="text-left px-5 py-2.5 font-medium hidden xl:table-cell">Observações</th>
                        {podeEditar && (
                          <th className="text-right px-5 py-2.5 font-medium">Ações</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {g.profissionais.map(prof => (
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
                            <div className="md:hidden text-xs text-muted-foreground mt-0.5">{prof.especialidade}</div>
                            <div className="lg:hidden text-xs text-muted-foreground mt-0.5">
                              {prof.sem_agenda
                                ? <span className="text-amber-600">Sem agenda cadastrada</span>
                                : prof.horarios}
                            </div>
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
                      ))}

                      {/* Linha "Adicionar neste grupo" */}
                      {podeEditar && (
                        <tr className="border-t bg-gray-50">
                          <td colSpan={podeEditar ? 6 : 5} className="px-5 py-2">
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setForm({ ...EMPTY_FORM, grupo: g.nome });
                                setFormError("");
                                setShowForm(true);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Plus size={12} /> Adicionar em {g.nome}
                            </button>
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

      {/* Legenda */}
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
            {/* Nome */}
            <div>
              <label className="text-sm font-medium">Nome completo *</label>
              <Input
                className="mt-1"
                placeholder="Ex: João da Silva"
                value={form.nome}
                onChange={f("nome")}
              />
            </div>

            {/* Especialidade */}
            <div>
              <label className="text-sm font-medium">Especialidade *</label>
              <Input
                className="mt-1"
                placeholder="Ex: Pediatra, Otorrinolaringologista"
                value={form.especialidade}
                onChange={f("especialidade")}
              />
            </div>

            {/* Grupo */}
            <div>
              <label className="text-sm font-medium">Grupo / Área *</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={form.grupo}
                onChange={f("grupo")}
              >
                <option value="">Selecione ou crie novo...</option>
                {nomesGrupos.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="__novo__">+ Criar novo grupo</option>
              </select>
              {form.grupo === "__novo__" && (
                <Input
                  className="mt-2"
                  placeholder="Nome do novo grupo"
                  value={form.grupo_novo}
                  onChange={f("grupo_novo")}
                />
              )}
              {grupoFinalLabel && (
                <p className="text-xs text-muted-foreground mt-1">Grupo: <strong>{grupoFinalLabel}</strong></p>
              )}
            </div>

            {/* Sem agenda */}
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded"
                checked={form.sem_agenda}
                onChange={e => setForm(prev => ({ ...prev, sem_agenda: e.target.checked }))}
              />
              <span className="text-amber-700 font-medium">Profissional ainda não liberou horário</span>
            </label>

            {/* Dias / Horários — só se não for sem_agenda */}
            {!form.sem_agenda && (
              <>
                <div>
                  <label className="text-sm font-medium">
                    <CalendarDays size={13} className="inline mr-1" />
                    Dias de atendimento
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="Ex: Segunda e Quarta / Sexta-feira"
                    value={form.dias}
                    onChange={f("dias")}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Use &quot; / &quot; para separar diferentes turnos</p>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    <Clock size={13} className="inline mr-1" />
                    Horários
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="Ex: 09:00 às 13:00 / 14:00 às 17:00"
                    value={form.horarios}
                    onChange={f("horarios")}
                  />
                </div>
              </>
            )}

            {/* Observações */}
            <div>
              <label className="text-sm font-medium">Observações</label>
              <textarea
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                placeholder="Informações adicionais, restrições de agenda..."
                value={form.observacoes}
                onChange={f("observacoes")}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <X size={14} />
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
