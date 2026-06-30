"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, Plus, Pencil, ClipboardList, ChevronDown, ChevronUp,
  Info, AlertCircle, ToggleLeft, ToggleRight, Stethoscope, FlaskConical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";

const UNIDADES = [
  { key: "Hospital",           label: "Hospital",           emoji: "🏥", header: "bg-blue-600",   chip: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "Clínica da Criança", label: "Clínica da Criança", emoji: "👶", header: "bg-pink-600",   chip: "bg-pink-100 text-pink-800 border-pink-200" },
  { key: "Levy",               label: "Instituto Levy",     emoji: "🏛️", header: "bg-purple-600", chip: "bg-purple-100 text-purple-800 border-purple-200" },
  { key: "Instituto",          label: "Instituto",          emoji: "🔬", header: "bg-green-600",  chip: "bg-green-100 text-green-800 border-green-200" },
  { key: "Barão",              label: "Barão",              emoji: "🏢", header: "bg-amber-600",  chip: "bg-amber-100 text-amber-800 border-amber-200" },
] as const;

type UnidadeKey = typeof UNIDADES[number]["key"];

const TIPOS = [
  { key: "exame",        label: "Exames",       icon: FlaskConical,     cor: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { key: "procedimento", label: "Procedimentos", icon: Stethoscope,  cor: "bg-teal-100 text-teal-700 border-teal-200" },
] as const;

type TipoKey = typeof TIPOS[number]["key"];

interface Procedimento {
  id: string;
  nome: string;
  tipo: TipoKey;
  unidade: UnidadeKey;
  descricao: string | null;
  preparacao: string | null;
  ativo: boolean;
  order_num: number;
}

const EMPTY_FORM = {
  nome: "",
  tipo: "exame" as TipoKey,
  unidade: "Hospital" as UnidadeKey,
  descricao: "",
  preparacao: "",
};

export default function ProcedimentosPage() {
  const { canEdit: podeEditar } = useMenuPermission("procedimentos");

  const [items, setItems] = useState<Procedimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [unidadeAtiva, setUnidadeAtiva] = useState<string>("Hospital");
  const [tipoAtivo, setTipoAtivo] = useState<string>("todos");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(["exame", "procedimento"]));

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/procedimentos");
      const json = await res.json();
      setItems(json.procedimentos ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const unidadeInfo = useMemo(
    () => UNIDADES.find(u => u.key === unidadeAtiva) ?? UNIDADES[0],
    [unidadeAtiva],
  );

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return items.filter(p => {
      if (p.unidade !== unidadeAtiva) return false;
      if (tipoAtivo !== "todos" && p.tipo !== tipoAtivo) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.descricao ?? "").toLowerCase().includes(termo) ||
        (p.preparacao ?? "").toLowerCase().includes(termo)
      );
    });
  }, [items, unidadeAtiva, tipoAtivo, busca]);

  const porTipo = useMemo(() => {
    const map = new Map<TipoKey, Procedimento[]>();
    for (const tipo of TIPOS) map.set(tipo.key, []);
    for (const p of filtrados) {
      if (!map.has(p.tipo)) map.set(p.tipo, []);
      map.get(p.tipo)!.push(p);
    }
    return map;
  }, [filtrados]);

  const toggleExpandido = (key: string) => {
    setExpandidos(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, unidade: unidadeAtiva as UnidadeKey });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (p: Procedimento) => {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      tipo: p.tipo,
      unidade: p.unidade,
      descricao: p.descricao ?? "",
      preparacao: p.preparacao ?? "",
    });
    setFormError("");
    setShowForm(true);
  };

  const save = async () => {
    if (!form.nome.trim() || !form.unidade) {
      setFormError("Nome e unidade são obrigatórios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        unidade: form.unidade,
        descricao: form.descricao.trim() || null,
        preparacao: form.preparacao.trim() || null,
      };
      const url = editingId ? `/api/procedimentos/${editingId}` : "/api/procedimentos";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json();
        setFormError(j.error ?? "Erro ao salvar.");
        return;
      }
      setShowForm(false);
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (p: Procedimento) => {
    await fetch(`/api/procedimentos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !p.ativo }),
    });
    fetchItems();
  };

  const f = (field: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const totalUnidade = items.filter(p => p.unidade === unidadeAtiva).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className={`${unidadeInfo.header} rounded-xl p-5 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList size={26} />
            <div>
              <h2 className="text-xl font-bold">Procedimentos e Exames</h2>
              {!loading && (
                <p className="text-white/80 text-sm">
                  {unidadeInfo.emoji} {unidadeInfo.label} · {totalUnidade} item{totalUnidade !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          {podeEditar && (
            <Button onClick={openCreate} className="bg-white/20 hover:bg-white/30 border-white/40 border text-white gap-2 shrink-0">
              <Plus size={15} /> Novo Item
            </Button>
          )}
        </div>

        {/* Tabs de unidade */}
        <div className="flex flex-wrap gap-2 mt-4">
          {UNIDADES.map(u => (
            <Button
              key={u.key}
              size="sm"
              onClick={() => setUnidadeAtiva(u.key)}
              variant="outline"
              className={`rounded-full text-sm h-8 px-3 ${
                unidadeAtiva === u.key
                  ? "bg-white text-gray-900 border-white hover:bg-white/90"
                  : "bg-white/20 text-white border-white/40 hover:bg-white/30"
              }`}
            >
              {u.emoji} {u.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Barra de busca + filtro de tipo */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou descrição..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["todos", ...TIPOS.map(t => t.key)].map(k => {
            const label = k === "todos" ? "Todos" : TIPOS.find(t => t.key === k)?.label ?? k;
            return (
              <Button
                key={k}
                size="sm"
                variant={tipoAtivo === k ? "default" : "outline"}
                onClick={() => setTipoAtivo(k)}
                className="rounded-full text-xs h-7"
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      )}

      {/* Conteúdo por tipo */}
      {!loading && (
        <div className="space-y-6">
          {TIPOS.filter(t => tipoAtivo === "todos" || tipoAtivo === t.key).map(tipo => {
            const lista = porTipo.get(tipo.key) ?? [];
            const Icon = tipo.icon;
            return (
              <Card key={tipo.key} className="overflow-hidden">
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left border-b h-auto rounded-none"
                  onClick={() => toggleExpandido(tipo.key)}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-gray-600" />
                    <span className="font-semibold text-gray-800">{tipo.label}</span>
                    <Badge variant="secondary" className="text-xs">{lista.length}</Badge>
                  </div>
                  {expandidos.has(tipo.key)
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />
                  }
                </Button>

                {expandidos.has(tipo.key) && (
                  <CardContent className="p-0">
                    {lista.length === 0 ? (
                      <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                        <Icon size={28} className="mx-auto mb-2 opacity-30" />
                        <p>Nenhum {tipo.label.toLowerCase().slice(0, -1)} cadastrado{busca ? ` para "${busca}"` : ""} para esta unidade.</p>
                        {podeEditar && (
                          <Button variant="link" size="sm" className="mt-2 text-xs h-auto p-0" onClick={openCreate}>
                            + Adicionar {tipo.key}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {lista.map(p => (
                          <div
                            key={p.id}
                            className={`px-5 py-4 flex items-start gap-4 ${!p.ativo ? "opacity-50" : ""}`}
                          >
                            <Badge className={`inline-flex items-center gap-1 text-xs shrink-0 mt-0.5 ${tipo.cor}`}>
                              <Icon size={11} />
                              {p.tipo === "exame" ? "Exame" : "Procedimento"}
                            </Badge>

                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{p.nome}</p>
                              {p.descricao && (
                                <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                                  <Info size={11} className="shrink-0 mt-0.5" />
                                  {p.descricao}
                                </p>
                              )}
                              {p.preparacao && (
                                <div className="mt-1.5 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-1.5">
                                  <p className="text-xs text-yellow-800 flex items-start gap-1">
                                    <AlertCircle size={11} className="shrink-0 mt-0.5" />
                                    <span><strong>Preparo:</strong> {p.preparacao}</span>
                                  </p>
                                </div>
                              )}
                            </div>

                            {podeEditar && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                                  <Pencil size={13} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title={p.ativo ? "Desativar" : "Ativar"}
                                  onClick={() => toggleAtivo(p)}
                                  className={p.ativo ? "text-green-600 hover:text-green-800" : "text-gray-400 hover:text-gray-600"}
                                >
                                  {p.ativo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {filtrados.length === 0 && !loading && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                <p>Nenhum item encontrado{busca ? ` para "${busca}"` : ""}.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modal formulário */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Item" : "Novo Procedimento / Exame"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(prev => ({ ...prev, tipo: v as TipoKey }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.key} value={t.key}>{t.label.slice(0, -1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidade *</Label>
                <Select value={form.unidade} onValueChange={v => setForm(prev => ({ ...prev, unidade: v as UnidadeKey }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map(u => <SelectItem key={u.key} value={u.key}>{u.emoji} {u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Hemograma completo, Ressonância magnética..." value={form.nome} onChange={f("nome")} />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                placeholder="Informações gerais sobre o exame ou procedimento..."
                value={form.descricao}
                onChange={f("descricao")}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <AlertCircle size={13} className="text-amber-600" /> Preparo / Instruções
              </Label>
              <Textarea
                rows={3}
                placeholder="Instruções de preparo que o paciente deve seguir antes do exame..."
                value={form.preparacao}
                onChange={f("preparacao")}
                className="resize-none border-yellow-300 bg-yellow-50 focus-visible:ring-yellow-400"
              />
              <p className="text-xs text-muted-foreground">Deixe em branco se não há preparo especial.</p>
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
