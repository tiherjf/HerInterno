"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Plus, Pencil, Trash2, Package, Monitor, Printer,
  Laptop, Server, Wifi, HardDrive, RefreshCw,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AssignedProfile {
  id: string;
  full_name: string;
  sector: string | null;
}

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  location: string | null;
  status: string;
  purchase_date: string | null;
  warranty_expiry: string | null;
  operating_system: string | null;
  ip_address: string | null;
  notes: string | null;
  purchase_value: number | null;
  useful_life_months: number | null;
  created_at: string;
  updated_at: string;
  assigned: AssignedProfile | null;
}

interface UserOption {
  id: string;
  full_name: string;
  sector: string | null;
}

const ASSET_TYPES = [
  { value: "desktop", label: "Desktop", icon: Monitor },
  { value: "notebook", label: "Notebook", icon: Laptop },
  { value: "servidor", label: "Servidor", icon: Server },
  { value: "impressora", label: "Impressora", icon: Printer },
  { value: "roteador", label: "Roteador/Switch", icon: Wifi },
  { value: "storage", label: "Storage/HD Externo", icon: HardDrive },
  { value: "outro", label: "Outro", icon: Package },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:      { label: "Ativo",         color: "bg-green-100 text-green-800" },
  maintenance: { label: "Manutenção",    color: "bg-yellow-100 text-yellow-800" },
  disposed:    { label: "Descartado",    color: "bg-red-100 text-red-800" },
};

// Vida útil padrão por tipo (meses) — alinhado com tabela RFB
const DEFAULT_USEFUL_LIFE: Record<string, number> = {
  desktop: 60, notebook: 48, servidor: 60,
  impressora: 60, roteador: 60, storage: 60, outro: 60,
};

const EMPTY_FORM = {
  name: "", asset_type: "desktop", brand: "", model: "",
  serial_number: "", asset_tag: "", location: "",
  assigned_to: "", status: "active",
  purchase_date: "", warranty_expiry: "",
  operating_system: "", ip_address: "", notes: "",
  purchase_value: "", useful_life_months: "60",
};

function calcDepreciacao(asset: Asset): {
  bookValue: number; depreciatedPct: number; annualRate: number; fullyDepreciated: boolean;
} | null {
  if (!asset.purchase_value || !asset.purchase_date) return null;
  const lifeMonths = asset.useful_life_months ?? 60;
  const purchaseMs = new Date(asset.purchase_date).getTime();
  const ageMonths = Math.max(0, (Date.now() - purchaseMs) / (1000 * 60 * 60 * 24 * 30.44));
  const depPct = Math.min(100, (ageMonths / lifeMonths) * 100);
  const bookValue = Math.max(0, asset.purchase_value * (1 - depPct / 100));
  return {
    bookValue: Math.round(bookValue * 100) / 100,
    depreciatedPct: Math.round(depPct),
    annualRate: Math.round((100 / (lifeMonths / 12)) * 10) / 10,
    fullyDepreciated: depPct >= 100,
  };
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function warrantyStatus(date: string | null): { label: string; color: string } | null {
  if (!date) return null;
  const exp = new Date(date).getTime();
  const now = Date.now();
  const days = Math.floor((exp - now) / 86400000);
  if (days < 0) return { label: "Vencida", color: "text-red-600" };
  if (days <= 90) return { label: `Vence em ${days}d`, color: "text-yellow-600" };
  return { label: `Válida até ${new Date(date).toLocaleDateString("pt-BR")}`, color: "text-green-600" };
}

export default function InventarioPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("type", filterType);
      const res = await fetch(`/api/admin/inventario?${params}`);
      const json = await res.json();
      setAssets(json.assets ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterType]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(j => setUsers((j.users ?? []).filter((u: { active: boolean }) => u.active)));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, useful_life_months: "60" });
    setShowForm(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      asset_type: asset.asset_type,
      brand: asset.brand ?? "",
      model: asset.model ?? "",
      serial_number: asset.serial_number ?? "",
      asset_tag: asset.asset_tag ?? "",
      location: asset.location ?? "",
      assigned_to: asset.assigned?.id ?? "",
      status: asset.status,
      purchase_date: asset.purchase_date ?? "",
      warranty_expiry: asset.warranty_expiry ?? "",
      operating_system: asset.operating_system ?? "",
      ip_address: asset.ip_address ?? "",
      notes: asset.notes ?? "",
      purchase_value: asset.purchase_value != null ? String(asset.purchase_value) : "",
      useful_life_months: String(asset.useful_life_months ?? DEFAULT_USEFUL_LIFE[asset.asset_type] ?? 60),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        assigned_to: form.assigned_to || null,
        purchase_date: form.purchase_date || null,
        warranty_expiry: form.warranty_expiry || null,
        purchase_value: form.purchase_value ? Number(form.purchase_value) : null,
        useful_life_months: form.useful_life_months ? Number(form.useful_life_months) : 60,
      };
      const url = editingId ? `/api/admin/inventario/${editingId}` : "/api/admin/inventario";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        fetchAssets();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteAsset = async (id: string) => {
    if (!confirm("Confirma exclusão deste equipamento?")) return;
    setDeleting(id);
    await fetch(`/api/admin/inventario/${id}`, { method: "DELETE" });
    setDeleting(null);
    fetchAssets();
  };

  const f = (field: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const TypeIcon = ASSET_TYPES.find(t => t.value === filterType)?.icon ?? Package;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventário de Equipamentos</h1>
          <p className="text-sm text-muted-foreground">Gestão de ativos de TI</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} /> Novo Equipamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-50">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
            placeholder="Buscar por nome, marca, modelo, serial..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={fetchAssets}>
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Contadores rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", count: assets.length, color: "bg-blue-50 text-blue-700" },
          { label: "Ativos", count: assets.filter(a => a.status === "active").length, color: "bg-green-50 text-green-700" },
          { label: "Manutenção", count: assets.filter(a => a.status === "maintenance").length, color: "bg-yellow-50 text-yellow-700" },
          { label: "Descartados", count: assets.filter(a => a.status === "disposed").length, color: "bg-red-50 text-red-700" },
        ].map(card => (
          <div key={card.label} className={`rounded-lg p-3 ${card.color}`}>
            <p className="text-2xl font-bold">{card.count}</p>
            <p className="text-xs font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Resumo financeiro / depreciação */}
      {(() => {
        const comValor = assets.filter(a => a.purchase_value);
        if (!comValor.length) return null;
        const totalInvestido = comValor.reduce((s, a) => s + (a.purchase_value ?? 0), 0);
        const totalAtual = comValor.reduce((s, a) => {
          const d = calcDepreciacao(a);
          return s + (d ? d.bookValue : (a.purchase_value ?? 0));
        }, 0);
        const totalDepreciado = totalInvestido - totalAtual;
        const fullDep = comValor.filter(a => { const d = calcDepreciacao(a); return d?.fullyDepreciated; }).length;
        return (
          <div className="bg-linear-to-r from-slate-50 to-gray-50 border rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Depreciação — {comValor.length} equipamentos com valor cadastrado</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Valor investido</p>
                <p className="text-lg font-bold text-gray-800">{formatBRL(totalInvestido)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor atual (contábil)</p>
                <p className="text-lg font-bold text-green-700">{formatBRL(totalAtual)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total depreciado</p>
                <p className="text-lg font-bold text-red-600">{formatBRL(totalDepreciado)}</p>
                <p className="text-[10px] text-muted-foreground">{totalInvestido > 0 ? Math.round((totalDepreciado / totalInvestido) * 100) : 0}% do total</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Totalmente depreciados</p>
                <p className="text-lg font-bold text-orange-600">{fullDep}</p>
                <p className="text-[10px] text-muted-foreground">equipamentos</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tabela */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Equipamento</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Serial / Patrimônio</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Localização</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Responsável</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Garantia</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Depreciação</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">IP</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-muted-foreground">Carregando...</td></tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <TypeIcon size={40} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-muted-foreground">Nenhum equipamento encontrado</p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Adicionar equipamento</Button>
                  </td>
                </tr>
              ) : assets.map(asset => {
                const warranty = warrantyStatus(asset.warranty_expiry);
                const AssetIcon = ASSET_TYPES.find(t => t.value === asset.asset_type)?.icon ?? Package;
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AssetIcon size={16} className="text-gray-400 shrink-0" />
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          {(asset.brand || asset.model) && (
                            <p className="text-xs text-muted-foreground">{[asset.brand, asset.model].filter(Boolean).join(" ")}</p>
                          )}
                          {asset.operating_system && (
                            <p className="text-xs text-blue-600">{asset.operating_system}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">
                      {ASSET_TYPES.find(t => t.value === asset.asset_type)?.label ?? asset.asset_type}
                    </td>
                    <td className="px-4 py-3">
                      {asset.serial_number && <p className="font-mono text-xs">{asset.serial_number}</p>}
                      {asset.asset_tag && <p className="text-xs text-muted-foreground">#{asset.asset_tag}</p>}
                      {!asset.serial_number && !asset.asset_tag && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{asset.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      {asset.assigned ? (
                        <div>
                          <p className="text-sm font-medium">{asset.assigned.full_name}</p>
                          {asset.assigned.sector && <p className="text-xs text-muted-foreground">{asset.assigned.sector}</p>}
                        </div>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_MAP[asset.status]?.color ?? "bg-gray-100"}`}>
                        {STATUS_MAP[asset.status]?.label ?? asset.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {warranty ? (
                        <span className={`text-xs ${warranty.color}`}>{warranty.label}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 min-w-36">
                      {(() => {
                        const dep = calcDepreciacao(asset);
                        if (!dep) return <span className="text-muted-foreground text-xs">—</span>;
                        return (
                          <div className="space-y-1">
                            <p className={`text-xs font-medium ${dep.fullyDepreciated ? "text-red-600" : "text-gray-700"}`}>
                              {formatBRL(dep.bookValue)}
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${dep.fullyDepreciated ? "bg-red-500" : dep.depreciatedPct > 70 ? "bg-orange-400" : "bg-blue-400"}`}
                                style={{ width: `${dep.depreciatedPct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{dep.depreciatedPct}% depreciado</p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{asset.ip_address ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(asset)}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteAsset(asset.id)}
                          disabled={deleting === asset.id}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal formulário */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome + Tipo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Nome *</label>
                <input
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Desktop RH 01"
                  value={form.name}
                  onChange={f("name")}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo *</label>
                <select
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  value={form.asset_type}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    asset_type: e.target.value,
                    useful_life_months: String(DEFAULT_USEFUL_LIFE[e.target.value] ?? 60),
                  }))}
                >
                  {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={form.status} onChange={f("status")}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {/* Marca + Modelo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Marca</label>
                <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Dell" value={form.brand} onChange={f("brand")} />
              </div>
              <div>
                <label className="text-sm font-medium">Modelo</label>
                <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="Ex: OptiPlex 7090" value={form.model} onChange={f("model")} />
              </div>
            </div>

            {/* Serial + Patrimônio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Número de Série</label>
                <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm font-mono" placeholder="SN12345" value={form.serial_number} onChange={f("serial_number")} />
              </div>
              <div>
                <label className="text-sm font-medium">Patrimônio / Asset Tag</label>
                <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm font-mono" placeholder="HER-001" value={form.asset_tag} onChange={f("asset_tag")} />
              </div>
            </div>

            {/* Localização + Responsável */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Localização</label>
                <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Sala TI — 2º Andar" value={form.location} onChange={f("location")} />
              </div>
              <div>
                <label className="text-sm font-medium">Usuário Responsável</label>
                <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={form.assigned_to} onChange={f("assigned_to")}>
                  <option value="">Sem responsável</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.sector ? ` (${u.sector})` : ""}</option>)}
                </select>
              </div>
            </div>

            {/* SO + IP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Sistema Operacional</label>
                <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Windows 11 Pro" value={form.operating_system} onChange={f("operating_system")} />
              </div>
              <div>
                <label className="text-sm font-medium">Endereço IP</label>
                <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm font-mono" placeholder="192.168.1.x" value={form.ip_address} onChange={f("ip_address")} />
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Data de Compra</label>
                <input type="date" className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={form.purchase_date} onChange={f("purchase_date")} />
              </div>
              <div>
                <label className="text-sm font-medium">Vencimento da Garantia</label>
                <input type="date" className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={form.warranty_expiry} onChange={f("warranty_expiry")} />
              </div>
            </div>

            {/* Depreciação */}
            <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-lg p-3">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-blue-700 mb-2">Depreciação (linear)</p>
              </div>
              <div>
                <label className="text-sm font-medium">Valor de Compra (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: 3500.00"
                  value={form.purchase_value}
                  onChange={f("purchase_value")}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Vida Útil (meses)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  placeholder="60"
                  value={form.useful_life_months}
                  onChange={f("useful_life_months")}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Padrão por tipo: Desktop/Servidor = 60m, Notebook = 48m</p>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="text-sm font-medium">Notas / Observações</label>
              <textarea
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Informações adicionais, histórico de manutenção..."
                value={form.notes}
                onChange={f("notes")}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
