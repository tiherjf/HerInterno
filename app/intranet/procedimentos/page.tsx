"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, Plus, Pencil, ClipboardList, ChevronDown, ChevronUp,
  Info, AlertCircle, ToggleLeft, ToggleRight, Stethoscope, FlaskConical,
  Sparkles, Syringe, Scissors, Slice, Grid2x2, Clock, CalendarCheck,
  FileText, Pill, Package, CreditCard, User, type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

// Rótulo interno para itens sem categoria (agrupados por último)
const SEM_CATEGORIA = "__geral__";

const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Ícone por categoria (palavra-chave → lucide). Fallback: ClipboardList.
function iconeCategoria(cat: string): LucideIcon {
  const c = cat.toLowerCase();
  if (/peeling/.test(c)) return Sparkles;
  if (/microagulhamento|mesoterapia/.test(c)) return Grid2x2;
  if (/toxina|botox|preenchimento/.test(c)) return Syringe;
  if (/bioestimulador|colágeno|colageno/.test(c)) return Sparkles;
  if (/curetagem|shaving|cauteriz/.test(c)) return Scissors;
  if (/cirúrgic|cirurgic/.test(c)) return Slice;
  if (/exame/.test(c)) return FlaskConical;
  return ClipboardList;
}

interface Procedimento {
  id: string;
  nome: string;
  tipo: TipoKey;
  unidade: UnidadeKey;
  descricao: string | null;
  preparacao: string | null;
  ativo: boolean;
  order_num: number;
  categoria: string | null;
  preco: number | null;
  unidade_medida: string | null;
  protocolo: string | null;
  profissional: string | null;
  // Migração 044
  convenios: string[] | null;
  atende_particular: boolean | null;
  parcelas_max: number | null;
  pacote_sessoes: number | null;
  pacote_preco: number | null;
  jejum_horas: number | null;
  requer_agendamento: boolean | null;
  duracao_min: number | null;
  documentos_necessarios: string | null;
  suspende_medicacao: string | null;
  medicos: string[] | null;
}

// Lista de médicos de um item: prefere `medicos[]`; senão divide o
// legado `profissional` em " e " / "," / ";".
function medicosDe(p: Procedimento): string[] {
  if (p.medicos && p.medicos.length) return p.medicos;
  if (p.profissional) {
    return p.profissional.split(/\s+e\s+|[,;]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

const EMPTY_FORM = {
  nome: "",
  tipo: "exame" as TipoKey,
  unidade: "Hospital" as UnidadeKey,
  descricao: "",
  preparacao: "",
  categoria: "",
  preco: null as number | null,
  unidade_medida: "",
  protocolo: "",
  profissional: "",
  // Migração 044 — convênios/médicos como string separada por vírgula no form
  convenios: "",
  atende_particular: true,
  parcelas_max: null as number | null,
  pacote_sessoes: null as number | null,
  pacote_preco: null as number | null,
  jejum_horas: null as number | null,
  requer_agendamento: false,
  duracao_min: null as number | null,
  documentos_necessarios: "",
  suspende_medicacao: "",
  medicos: "",
};

export default function ProcedimentosPage() {
  const { canEdit: podeEditar } = useMenuPermission("procedimentos");

  const [items, setItems] = useState<Procedimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [unidadeAtiva, setUnidadeAtiva] = useState<string>("Hospital");
  const [tipoAtivo, setTipoAtivo] = useState<string>("todos");
  const [medicoAtivo, setMedicoAtivo] = useState<string>("todos");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(["exame", "procedimento"]));
  const [aviso, setAviso] = useState("");

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

  // Ao trocar de unidade, o filtro de médico volta para "Todos"
  useEffect(() => { setMedicoAtivo("todos"); }, [unidadeAtiva]);

  const unidadeInfo = useMemo(
    () => UNIDADES.find(u => u.key === unidadeAtiva) ?? UNIDADES[0],
    [unidadeAtiva],
  );

  // Categorias já usadas (para reaproveitar no datalist do formulário)
  const categoriasExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) if (p.categoria?.trim()) set.add(p.categoria.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  // Convênios já usados (datalist do formulário)
  const conveniosExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) for (const c of p.convenios ?? []) if (c.trim()) set.add(c.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  // Médicos já usados (datalist do formulário) — considera legado `profissional`
  const medicosExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) for (const m of medicosDe(p)) set.add(m);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  // Médicos distintos na unidade ativa (para o filtro por médico)
  const medicosUnidade = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) {
      if (p.unidade !== unidadeAtiva) continue;
      for (const m of medicosDe(p)) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items, unidadeAtiva]);

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return items.filter(p => {
      if (p.unidade !== unidadeAtiva) return false;
      if (tipoAtivo !== "todos" && p.tipo !== tipoAtivo) return false;
      const meds = medicosDe(p);
      if (medicoAtivo !== "todos" && !meds.includes(medicoAtivo)) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.descricao ?? "").toLowerCase().includes(termo) ||
        (p.preparacao ?? "").toLowerCase().includes(termo) ||
        (p.categoria ?? "").toLowerCase().includes(termo) ||
        (p.profissional ?? "").toLowerCase().includes(termo) ||
        meds.some(m => m.toLowerCase().includes(termo))
      );
    });
  }, [items, unidadeAtiva, tipoAtivo, medicoAtivo, busca]);

  const porTipo = useMemo(() => {
    const map = new Map<TipoKey, Procedimento[]>();
    for (const tipo of TIPOS) map.set(tipo.key, []);
    for (const p of filtrados) {
      if (!map.has(p.tipo)) map.set(p.tipo, []);
      map.get(p.tipo)!.push(p);
    }
    return map;
  }, [filtrados]);

  // Sub-agrupa uma lista por categoria; categorias ordenadas pelo menor
  // order_num contido nelas; itens sem categoria ("Geral") vão por último.
  const agruparPorCategoria = useCallback((lista: Procedimento[]) => {
    const map = new Map<string, Procedimento[]>();
    for (const p of lista) {
      const cat = p.categoria?.trim() || SEM_CATEGORIA;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries())
      .map(([cat, catItems]) => ({
        cat,
        items: catItems,
        minOrder: Math.min(...catItems.map(i => i.order_num ?? Number.MAX_SAFE_INTEGER)),
      }))
      .sort((a, b) => {
        if (a.cat === SEM_CATEGORIA) return 1;
        if (b.cat === SEM_CATEGORIA) return -1;
        return a.minOrder - b.minOrder;
      });
  }, []);

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
      categoria: p.categoria ?? "",
      preco: p.preco ?? null,
      unidade_medida: p.unidade_medida ?? "",
      protocolo: p.protocolo ?? "",
      profissional: p.profissional ?? "",
      convenios: (p.convenios ?? []).join(", "),
      atende_particular: p.atende_particular ?? true,
      parcelas_max: p.parcelas_max ?? null,
      pacote_sessoes: p.pacote_sessoes ?? null,
      pacote_preco: p.pacote_preco ?? null,
      jejum_horas: p.jejum_horas ?? null,
      requer_agendamento: p.requer_agendamento ?? false,
      duracao_min: p.duracao_min ?? null,
      documentos_necessarios: p.documentos_necessarios ?? "",
      suspende_medicacao: p.suspende_medicacao ?? "",
      medicos: (p.medicos ?? []).join(", "),
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
        categoria: form.categoria.trim() || null,
        preco: form.preco,
        unidade_medida: form.unidade_medida.trim() || null,
        protocolo: form.protocolo.trim() || null,
        profissional: form.profissional.trim() || null,
        // 044 — convênios/médicos vão como string por vírgula (a API divide)
        convenios: form.convenios,
        atende_particular: form.atende_particular,
        parcelas_max: form.parcelas_max,
        pacote_sessoes: form.pacote_sessoes,
        pacote_preco: form.pacote_preco,
        jejum_horas: form.jejum_horas,
        requer_agendamento: form.requer_agendamento,
        duracao_min: form.duracao_min,
        documentos_necessarios: form.documentos_necessarios.trim() || null,
        suspende_medicacao: form.suspende_medicacao.trim() || null,
        medicos: form.medicos,
      };
      const url = editingId ? `/api/procedimentos/${editingId}` : "/api/procedimentos";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(j.error ?? "Erro ao salvar.");
        return;
      }
      setAviso(j.aviso ?? "");
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

  // Handler genérico para campos de texto do formulário
  const f = (field:
    | "nome" | "descricao" | "preparacao" | "categoria" | "unidade_medida"
    | "protocolo" | "profissional" | "documentos_necessarios"
    | "suspende_medicacao" | "convenios" | "medicos"
  ) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Handler genérico para campos numéricos (inteiros/preços) — "" → null
  const num = (field: "parcelas_max" | "pacote_sessoes" | "pacote_preco" | "jejum_horas" | "duracao_min") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const v = e.target.value;
    setForm(prev => ({ ...prev, [field]: v === "" ? null : Number(v) }));
  };

  const totalUnidade = items.filter(p => p.unidade === unidadeAtiva).length;

  // Renderiza um item (card) — reutilizado dentro de cada categoria
  const renderItem = (p: Procedimento) => {
    const tipoInfo = TIPOS.find(t => t.key === p.tipo) ?? TIPOS[0];
    const Icon = tipoInfo.icon;
    const meds = medicosDe(p);
    const parcela = p.preco != null && p.parcelas_max ? p.preco / p.parcelas_max : null;
    const temPacote = p.pacote_sessoes != null && p.pacote_preco != null;
    const economia = temPacote && p.preco != null
      ? p.preco * (p.pacote_sessoes ?? 0) - (p.pacote_preco ?? 0)
      : 0;

    // Chips de preparo estruturado
    const chips: { icon: LucideIcon; texto: string; titulo?: string }[] = [];
    if (p.jejum_horas != null) {
      chips.push({ icon: Clock, texto: p.jejum_horas === 0 ? "Sem jejum" : `Jejum ${p.jejum_horas}h` });
    }
    if (p.requer_agendamento) chips.push({ icon: CalendarCheck, texto: "Requer agendamento" });
    if (p.duracao_min != null) chips.push({ icon: Clock, texto: `${p.duracao_min} min` });
    if (p.documentos_necessarios) {
      chips.push({ icon: FileText, texto: "Documentos", titulo: p.documentos_necessarios });
    }
    if (p.suspende_medicacao) {
      chips.push({ icon: Pill, texto: "Suspender medicação", titulo: p.suspende_medicacao });
    }

    return (
      <div
        key={p.id}
        className={`px-5 py-4 flex items-start gap-4 ${!p.ativo ? "opacity-50" : ""}`}
      >
        <Badge className={`inline-flex items-center gap-1 text-xs shrink-0 mt-0.5 ${tipoInfo.cor}`}>
          <Icon size={11} />
          {p.tipo === "exame" ? "Exame" : "Procedimento"}
        </Badge>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 text-sm">{p.nome}</p>
            {meds.map(m => (
              <Badge key={m} variant="outline" className="inline-flex items-center gap-1 text-[10px] font-normal text-gray-500 border-gray-200">
                <User size={9} /> {m}
              </Badge>
            ))}
          </div>

          {/* Convênios + Particular */}
          {(p.convenios?.length || p.atende_particular) ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {(p.convenios ?? []).map(c => (
                <Badge key={c} className="text-[10px] font-normal bg-green-100 text-green-800 border-green-200">
                  {c}
                </Badge>
              ))}
              {p.atende_particular && (
                <Badge variant="outline" className="text-[10px] font-normal text-gray-500 border-gray-200 bg-gray-50">
                  Particular
                </Badge>
              )}
            </div>
          ) : null}

          {/* Preparo estruturado (chips) */}
          {chips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {chips.map((c, i) => {
                const CIcon = c.icon;
                return (
                  <span
                    key={i}
                    title={c.titulo}
                    className={`inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600 ${c.titulo ? "cursor-help" : ""}`}
                  >
                    <CIcon size={10} /> {c.texto}
                  </span>
                );
              })}
            </div>
          )}

          {p.descricao && (
            <p className="text-xs text-gray-500 flex items-start gap-1">
              <Info size={11} className="shrink-0 mt-0.5" />
              {p.descricao}
            </p>
          )}

          {/* Pacote destacado (ou protocolo legado como fallback) */}
          {temPacote ? (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
              <Package size={12} className="shrink-0" />
              <span>
                <strong>{p.pacote_sessoes} sessões:</strong> {fmtBRL.format(p.pacote_preco ?? 0)}
                {economia > 0 && (
                  <span className="text-emerald-600"> · economize {fmtBRL.format(economia)}</span>
                )}
              </span>
            </div>
          ) : p.protocolo ? (
            <p className="text-xs text-gray-400">{p.protocolo}</p>
          ) : null}

          {/* Observações de preparo (texto livre) */}
          {p.preparacao && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-1.5">
              <p className="text-xs text-yellow-800 flex items-start gap-1">
                <AlertCircle size={11} className="shrink-0 mt-0.5" />
                <span><strong>Observações de preparo:</strong> {p.preparacao}</span>
              </p>
            </div>
          )}
        </div>

        {p.preco != null && (
          <div className="shrink-0 text-right space-y-1">
            <p className="font-bold text-gray-900 text-base whitespace-nowrap leading-tight">
              {fmtBRL.format(p.preco)}
              {p.unidade_medida ? <span className="block font-normal text-[11px] text-gray-400"> /{p.unidade_medida}</span> : null}
            </p>
            {p.parcelas_max ? (
              <Badge variant="outline" className="inline-flex items-center gap-1 text-[10px] font-normal text-gray-500 border-gray-200">
                <CreditCard size={9} />
                em até {p.parcelas_max}x{parcela != null ? ` de ${fmtBRL.format(parcela)}` : ""}
              </Badge>
            ) : null}
          </div>
        )}

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
    );
  };

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

      {/* Aviso de migração pendente */}
      {aviso && (
        <Alert>
          <AlertCircle size={16} />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{aviso}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAviso("")}>Fechar</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Barra de busca + filtro de tipo + filtro de médico */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, descrição, categoria ou médico..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
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
          {medicosUnidade.length > 0 && (
            <Select value={medicoAtivo} onValueChange={setMedicoAtivo}>
              <SelectTrigger className="h-7 w-auto min-w-[9rem] rounded-full text-xs gap-1">
                <User size={13} className="text-muted-foreground" />
                <SelectValue placeholder="Médico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Médico: Todos</SelectItem>
                {medicosUnidade.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            const grupos = agruparPorCategoria(lista);
            const semSubgrupos = grupos.length === 1 && grupos[0].cat === SEM_CATEGORIA;
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
                    ) : semSubgrupos ? (
                      <div className="divide-y">
                        {grupos[0].items.map(renderItem)}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {grupos.map(g => {
                          const CatIcon = g.cat === SEM_CATEGORIA ? ClipboardList : iconeCategoria(g.cat);
                          return (
                            <div key={g.cat}>
                              <div className="px-5 pt-3 pb-1 bg-gray-50/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                  <CatIcon size={13} className="text-muted-foreground/70" />
                                  {g.cat === SEM_CATEGORIA ? "Geral" : g.cat}
                                </p>
                              </div>
                              <div className="divide-y">
                                {g.items.map(renderItem)}
                              </div>
                            </div>
                          );
                        })}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input
                  list="categorias-existentes"
                  placeholder="Ex: Peeling, Toxina botulínica..."
                  value={form.categoria}
                  onChange={f("categoria")}
                />
                <datalist id="categorias-existentes">
                  {categoriasExistentes.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Preço</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    className="pl-9"
                    value={form.preco ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(prev => ({ ...prev, preco: v === "" ? null : Number(v) }));
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unidade de medida</Label>
                <Input placeholder="sessão, ampola, frasco…" value={form.unidade_medida} onChange={f("unidade_medida")} />
              </div>
              <div className="space-y-1.5">
                <Label>Protocolo (texto livre)</Label>
                <Input placeholder="Protocolo 3 sessões: R$ 1.200,00" value={form.protocolo} onChange={f("protocolo")} />
              </div>
            </div>

            {/* Seção: Valores & pagamento */}
            <div className="pt-2 border-t">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
                <CreditCard size={13} /> Valores &amp; pagamento
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Parcelas máx.</Label>
                  <Input type="number" min="0" step="1" placeholder="6" value={form.parcelas_max ?? ""} onChange={num("parcelas_max")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pacote: sessões</Label>
                  <Input type="number" min="0" step="1" placeholder="3" value={form.pacote_sessoes ?? ""} onChange={num("pacote_sessoes")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preço do pacote</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input type="number" min="0" step="0.01" placeholder="0,00" className="pl-9" value={form.pacote_preco ?? ""} onChange={num("pacote_preco")} />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção: Preparo */}
            <div className="pt-2 border-t">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
                <Clock size={13} /> Preparo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Jejum (horas)</Label>
                  <Input type="number" min="0" step="1" placeholder="8" value={form.jejum_horas ?? ""} onChange={num("jejum_horas")} />
                  <p className="text-[11px] text-muted-foreground">0 = sem jejum</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Duração (min)</Label>
                  <Input type="number" min="0" step="1" placeholder="30" value={form.duracao_min ?? ""} onChange={num("duracao_min")} />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <Checkbox
                  checked={form.requer_agendamento}
                  onCheckedChange={v => setForm(prev => ({ ...prev, requer_agendamento: v === true }))}
                />
                <span className="text-sm">Requer agendamento</span>
              </label>
              <div className="space-y-1.5 mt-3">
                <Label>Documentos necessários</Label>
                <Input placeholder="Ex: Pedido médico, RG, carteirinha do convênio…" value={form.documentos_necessarios} onChange={f("documentos_necessarios")} />
              </div>
              <div className="space-y-1.5 mt-3">
                <Label>Suspender medicação</Label>
                <Input placeholder="Ex: Suspender anticoagulante 3 dias antes…" value={form.suspende_medicacao} onChange={f("suspende_medicacao")} />
              </div>
            </div>

            {/* Seção: Convênios & médicos */}
            <div className="pt-2 border-t">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
                <User size={13} /> Convênios &amp; médicos
              </p>
              <div className="space-y-1.5">
                <Label>Convênios</Label>
                <Input
                  list="convenios-existentes"
                  placeholder="Ex: Unimed, Bradesco, SulAmérica"
                  value={form.convenios}
                  onChange={f("convenios")}
                />
                <datalist id="convenios-existentes">
                  {conveniosExistentes.map(c => <option key={c} value={c} />)}
                </datalist>
                <p className="text-[11px] text-muted-foreground">Separe por vírgula.</p>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <Checkbox
                  checked={form.atende_particular}
                  onCheckedChange={v => setForm(prev => ({ ...prev, atende_particular: v === true }))}
                />
                <span className="text-sm">Atende particular</span>
              </label>
              <div className="space-y-1.5 mt-3">
                <Label>Médicos</Label>
                <Input
                  list="medicos-existentes"
                  placeholder="Ex: Dra. Thais, Dra. Jessica"
                  value={form.medicos}
                  onChange={f("medicos")}
                />
                <datalist id="medicos-existentes">
                  {medicosExistentes.map(m => <option key={m} value={m} />)}
                </datalist>
                <p className="text-[11px] text-muted-foreground">Separe por vírgula.</p>
              </div>
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
                <AlertCircle size={13} className="text-amber-600" /> Observações de preparo
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
