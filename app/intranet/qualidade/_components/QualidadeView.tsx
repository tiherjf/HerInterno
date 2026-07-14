"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, LayoutDashboard, AlertTriangle, BarChart2, FileText, ClipboardList, Settings2, Plus, Loader2, ShieldAlert, Brain, Network } from "lucide-react";
import { PainelTab } from "./PainelTab";
import { NCsTab } from "./NCsTab";
import { IndicadoresTab } from "./IndicadoresTab";
import { DocumentosTab } from "./DocumentosTab";
import { AuditoriasTab } from "./AuditoriasTab";
import { RiscosTab } from "./RiscosTab";
import { AnalisesTab } from "./AnalisesTab";
import { ProcessosTab } from "./ProcessosTab";

export interface Setor { id: string; name: string; color: string; description: string | null; active: boolean }

const TABS = [
  { id: "painel",      label: "Painel",             icon: LayoutDashboard },
  { id: "ncs",         label: "Não-Conformidades",  icon: AlertTriangle },
  { id: "indicadores", label: "Indicadores",         icon: BarChart2 },
  { id: "documentos",  label: "Documentos",          icon: FileText },
  { id: "auditorias",  label: "Auditorias",          icon: ClipboardList },
  { id: "riscos",      label: "Riscos",              icon: ShieldAlert },
  { id: "analises",    label: "Análises Críticas",   icon: Brain },
  { id: "processos",   label: "Processos",           icon: Network },
] as const;

type TabId = typeof TABS[number]["id"];

const COLOR_PILL: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-700 border-gray-300 data-[active=true]:bg-gray-700 data-[active=true]:text-white",
  red:    "bg-red-50 text-red-700 border-red-200 data-[active=true]:bg-red-600 data-[active=true]:text-white",
  blue:   "bg-blue-50 text-blue-700 border-blue-200 data-[active=true]:bg-blue-600 data-[active=true]:text-white",
  purple: "bg-purple-50 text-purple-700 border-purple-200 data-[active=true]:bg-purple-600 data-[active=true]:text-white",
  teal:   "bg-teal-50 text-teal-700 border-teal-200 data-[active=true]:bg-teal-600 data-[active=true]:text-white",
  orange: "bg-orange-50 text-orange-700 border-orange-200 data-[active=true]:bg-orange-600 data-[active=true]:text-white",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 data-[active=true]:bg-indigo-600 data-[active=true]:text-white",
  green:  "bg-green-50 text-green-700 border-green-200 data-[active=true]:bg-green-600 data-[active=true]:text-white",
  amber:  "bg-amber-50 text-amber-700 border-amber-200 data-[active=true]:bg-amber-600 data-[active=true]:text-white",
  pink:   "bg-pink-50 text-pink-700 border-pink-200 data-[active=true]:bg-pink-600 data-[active=true]:text-white",
  cyan:   "bg-cyan-50 text-cyan-700 border-cyan-200 data-[active=true]:bg-cyan-600 data-[active=true]:text-white",
};

interface Props { isAdmin: boolean; setores: Setor[] }

export function QualidadeView({ isAdmin, setores: initialSetores }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("painel");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [setores, setSetores] = useState<Setor[]>(initialSetores);
  const [showSetores, setShowSetores] = useState(false);
  const [newSetor, setNewSetor] = useState({ name: "", color: "blue" });
  const [setorSaving, setSetorSaving] = useState(false);
  const [setorError, setSetorError] = useState("");

  const activeSetores = setores.filter(s => s.active);

  async function createSetor() {
    if (!newSetor.name.trim()) { setSetorError("Nome é obrigatório"); return; }
    setSetorSaving(true); setSetorError("");
    const r = await fetch("/api/qualidade/setores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSetor),
    });
    const d = await r.json();
    if (!r.ok) { setSetorError(d.error || "Erro"); setSetorSaving(false); return; }
    setSetores(prev => [...prev, d.setor]);
    setNewSetor({ name: "", color: "blue" });
    setSetorSaving(false);
  }

  async function toggleSetor(id: string, active: boolean) {
    await fetch(`/api/qualidade/setores/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setSetores(prev => prev.map(s => s.id === id ? { ...s, active } : s));
    if (!active && setores.find(s => s.id === id)?.name === selectedSector) {
      setSelectedSector(null);
    }
  }

  const tabProps = { sector: selectedSector, isAdmin, setores: activeSetores };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="brand-gradient rounded-xl p-5 text-white mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="opacity-80" />
            <div>
              <h2 className="text-xl font-bold leading-tight">Gestão da Qualidade</h2>
              <p className="text-white/60 text-xs mt-0.5">Ciclo PDCA — melhoria contínua</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/10 border border-white/20 gap-1.5"
              onClick={() => setShowSetores(true)}>
              <Settings2 size={14} /> Setores
            </Button>
          )}
        </div>
      </div>

      {/* Sector pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-1 scrollbar-none">
        <button
          data-active={selectedSector === null}
          onClick={() => setSelectedSector(null)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap bg-gray-100 text-gray-700 border-gray-300 data-[active=true]:bg-gray-800 data-[active=true]:text-white">
          Todos os setores
        </button>
        {activeSetores.map(s => (
          <button
            key={s.id}
            data-active={selectedSector === s.name}
            onClick={() => setSelectedSector(prev => prev === s.name ? null : s.name)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${COLOR_PILL[s.color] ?? COLOR_PILL.gray}`}>
            {s.name}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b mb-5 overflow-x-auto scrollbar-none">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all -mb-px ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-gray-700 hover:border-gray-300"
              }`}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "painel"      && <PainelTab      {...tabProps} />}
        {activeTab === "ncs"         && <NCsTab         {...tabProps} />}
        {activeTab === "indicadores" && <IndicadoresTab {...tabProps} />}
        {activeTab === "documentos"  && <DocumentosTab  {...tabProps} />}
        {activeTab === "auditorias"  && <AuditoriasTab  {...tabProps} />}
        {activeTab === "riscos"      && <RiscosTab      {...tabProps} />}
        {activeTab === "analises"    && <AnalisesTab    {...tabProps} />}
        {activeTab === "processos"   && <ProcessosTab   {...tabProps} />}
      </div>

      {/* Setores management dialog */}
      <Dialog open={showSetores} onOpenChange={setShowSetores}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 size={16} /> Gerenciar Setores</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Add new */}
            <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Novo setor</p>
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Nome do setor" value={newSetor.name} onChange={e => setNewSetor({...newSetor, name: e.target.value})} />
                <Select value={newSetor.color} onValueChange={v => setNewSetor({...newSetor, color: v})}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(COLOR_PILL).map(c => <SelectItem key={c} value={c}><span className="capitalize">{c}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={createSetor} disabled={setorSaving}>
                  {setorSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                </Button>
              </div>
              {setorError && <p className="text-xs text-red-600">{setorError}</p>}
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {setores.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2.5 bg-white border rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full bg-${s.color}-400`} />
                    <span className="text-sm font-medium">{s.name}</span>
                  </div>
                  <button
                    onClick={() => toggleSetor(s.id, !s.active)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                      s.active
                        ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    }`}>
                    {s.active ? "Ativo" : "Inativo"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
