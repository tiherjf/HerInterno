"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ALL_ROLES, ROLE_LABELS, CATEGORY_ORDER } from "@/lib/menu/types";
import type { MenuItemConfig, StaffRole } from "@/lib/menu/types";
import {
  Eye, PenLine, Shield, Loader2, Check, AlertCircle,
  Layers, Info,
} from "lucide-react";

// Roles editáveis (apenas admin é fixo)
const EDITABLE_ROLES: StaffRole[] = ["ti", "marketing", "rh", "recepcao", "enfermagem", "administrativo", "manutencao", "qualidade"];

// Cores de destaque por role
const ROLE_ACCENT: Record<string, string> = {
  ti:        "text-indigo-600",
  marketing: "text-pink-600",
  rh:        "text-violet-600",
  recepcao:  "text-emerald-600",
  enfermagem:"text-cyan-600",
  administrativo: "text-orange-600",
  manutencao:"text-amber-700",
  qualidade: "text-teal-600",
};

interface ItemState {
  can_view: Set<StaffRole>;
  can_edit: Set<StaffRole>;
  active: boolean;
  isDirty: boolean;
  updated_at: string | null;
  updated_by_name: string | null;
}

interface Props { items: MenuItemConfig[] }

export function MenuPermissionsEditor({ items }: Props) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map(item => [
        item.key,
        {
          can_view: new Set(item.can_view as StaffRole[]),
          can_edit: new Set(item.can_edit as StaffRole[]),
          active: item.active,
          isDirty: false,
          updated_at: item.updated_at ?? null,
          updated_by_name: item.updated_by_name ?? null,
        },
      ])
    )
  );

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewRole, setPreviewRole] = useState<StaffRole | null>(null);

  const dirtyKeys = useMemo(() => Object.entries(state).filter(([, s]) => s.isDirty).map(([k]) => k), [state]);
  const dirtyCount = dirtyKeys.length;

  // ─── Mutações ───────────────────────────────────────────────
  function markDirty(key: string, partial: Partial<ItemState>) {
    setState(prev => ({ ...prev, [key]: { ...prev[key], ...partial, isDirty: true } }));
  }

  function toggleView(key: string, role: StaffRole) {
    if (role === "admin") return;
    setState(prev => {
      const s = prev[key];
      const canView = new Set(s.can_view);
      const canEdit = new Set(s.can_edit);
      if (canView.has(role)) {
        canView.delete(role);
        canEdit.delete(role); // cascade: remove edit when view removed
      } else {
        canView.add(role);
      }
      return { ...prev, [key]: { ...s, can_view: canView, can_edit: canEdit, isDirty: true } };
    });
  }

  function toggleEdit(key: string, role: StaffRole) {
    if (role === "admin") return;
    setState(prev => {
      const s = prev[key];
      if (!s.can_view.has(role)) return prev; // can't edit without view
      const canEdit = new Set(s.can_edit);
      if (canEdit.has(role)) canEdit.delete(role);
      else canEdit.add(role);
      return { ...prev, [key]: { ...s, can_edit: canEdit, isDirty: true } };
    });
  }

  function toggleActive(key: string) {
    setState(prev => ({
      ...prev,
      [key]: { ...prev[key], active: !prev[key].active, isDirty: true },
    }));
  }

  // Select/deselect entire column
  function columnToggle(role: StaffRole, type: "view" | "edit") {
    setState(prev => {
      const next = { ...prev };
      const keys = items.map(i => i.key);
      // Determine if we should select or deselect
      const allOn = keys.every(k => type === "view" ? prev[k].can_view.has(role) : prev[k].can_edit.has(role));
      for (const k of keys) {
        const s = { ...next[k] };
        if (type === "view") {
          const canView = new Set(s.can_view);
          const canEdit = new Set(s.can_edit);
          if (allOn) { canView.delete(role); canEdit.delete(role); }
          else canView.add(role);
          next[k] = { ...s, can_view: canView, can_edit: canEdit, isDirty: true };
        } else {
          const canEdit = new Set(s.can_edit);
          // Only edit for items where this role can view
          if (s.can_view.has(role)) {
            if (allOn) canEdit.delete(role);
            else canEdit.add(role);
            next[k] = { ...s, can_edit: canEdit, isDirty: true };
          }
        }
      }
      return next;
    });
  }

  // ─── Save ────────────────────────────────────────────────────
  async function saveAll() {
    if (dirtyCount === 0) return;
    setSaving(true);
    setSaveError(null);
    const payload = dirtyKeys.map(key => ({
      key,
      can_view: Array.from(state[key].can_view),
      can_edit: Array.from(state[key].can_edit),
      active: state[key].active,
    }));

    const res = await fetch("/api/menu/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    });
    const json = await res.json();

    if (!res.ok) {
      setSaveError(json.error ?? "Erro ao salvar.");
    } else {
      const now = json.updated_at ?? new Date().toISOString();
      setState(prev => {
        const next = { ...prev };
        for (const key of dirtyKeys) {
          next[key] = { ...next[key], isDirty: false, updated_at: now };
        }
        return next;
      });
      setLastSavedAt(now);
    }
    setSaving(false);
  }

  // ─── Agrupamento ─────────────────────────────────────────────
  const grouped = useMemo(() => {
    const known = new Set<string>(CATEGORY_ORDER);
    const groups = CATEGORY_ORDER.map(cat => ({
      category: cat as string,
      items: items.filter(i => i.category === cat).sort((a, b) => a.order_num - b.order_num),
    })).filter(g => g.items.length > 0);
    const extras = items.filter(i => !known.has(i.category));
    if (extras.length > 0) groups.push({ category: "Outros", items: extras });
    return groups;
  }, [items]);

  // ─── Column stats ─────────────────────────────────────────────
  function colStats(role: StaffRole) {
    const total = items.length;
    const viewCount = items.filter(i => state[i.key]?.can_view.has(role)).length;
    const editCount = items.filter(i => state[i.key]?.can_edit.has(role)).length;
    return { total, viewCount, editCount };
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Preview dropdown */}
          <Select value={previewRole ?? ""} onValueChange={v => setPreviewRole((v as StaffRole) || null)}>
            <SelectTrigger className="w-52 bg-white">
              <div className="flex items-center gap-1.5 text-sm">
                <Layers size={14} className="text-muted-foreground" />
                <SelectValue placeholder="Simular como perfil..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              {EDITABLE_ROLES.map(role => (
                <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
            <Info size={12} className="text-blue-500 shrink-0" />
            Apenas o Admin tem acesso total sempre
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveError && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={13} /> {saveError}
            </span>
          )}
          {lastSavedAt && dirtyCount === 0 && !saveError && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <Check size={13} />
              Salvo às {new Date(lastSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {dirtyCount > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
              {dirtyCount} {dirtyCount === 1 ? "alteração" : "alterações"} pendente{dirtyCount !== 1 ? "s" : ""}
            </span>
          )}
          <Button onClick={saveAll} disabled={saving || dirtyCount === 0} size="sm" className="min-w-36">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
              : dirtyCount > 0
                ? `Salvar ${dirtyCount} ${dirtyCount === 1 ? "alteração" : "alterações"}`
                : "Nada para salvar"}
          </Button>
        </div>
      </div>

      {/* Matrix table */}
      <div className="rounded-xl border bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50/80">
              {/* Item col */}
              <th className="sticky left-0 bg-gray-50/95 z-10 text-left px-4 py-3 font-semibold text-gray-600 min-w-47.5 border-r">
                Item de menu
              </th>
              {/* Ativo col */}
              <th className="px-3 py-3 text-center font-semibold text-gray-600 w-16 whitespace-nowrap">
                Ativo
              </th>
              {/* Sistema col */}
              <th className="px-3 py-3 text-center w-20 border-r">
                <div className="flex flex-col items-center gap-1">
                  <Shield size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">Sistema</span>
                </div>
              </th>
              {/* Role cols */}
              {EDITABLE_ROLES.map(role => {
                const { viewCount, editCount, total } = colStats(role);
                return (
                  <th key={role} className="px-2 py-2 text-center min-w-22">
                    <div className={`text-xs font-semibold mb-1 ${ROLE_ACCENT[role]}`}>
                      {ROLE_LABELS[role]}
                    </div>
                    {/* Column select-all mini buttons */}
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => columnToggle(role, "view")}
                        title={viewCount === total ? "Remover visualização de todos" : "Dar visualização a todos"}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          viewCount === total
                            ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                            : "bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                        }`}
                      >
                        <Eye size={9} /> {viewCount}/{total}
                      </button>
                      <button
                        onClick={() => columnToggle(role, "edit")}
                        title={editCount === total ? "Remover edição de todos" : "Dar edição a todos (com visualização)"}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          editCount === total
                            ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                            : "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600"
                        }`}
                      >
                        <PenLine size={9} /> {editCount}/{total}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {grouped.map(({ category, items: catItems }) => (
            <tbody key={category}>
              {/* Category header row */}
              <tr className="bg-primary/5 border-y border-primary/10">
                <td
                  colSpan={3 + EDITABLE_ROLES.length}
                  className="sticky left-0 px-4 py-2"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-primary/70">
                    {category}
                  </span>
                </td>
              </tr>

              {/* Item rows */}
              {catItems.map(item => {
                const s = state[item.key];
                if (!s) return null;
                return (
                  <tr
                    key={item.key}
                    className={`border-b transition-colors ${
                      s.isDirty ? "bg-amber-50/50" : "hover:bg-gray-50/50"
                    }`}
                  >
                    {/* Item name + meta */}
                    <td className="sticky left-0 bg-inherit z-10 px-4 py-3 border-r">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${s.active ? "text-gray-800" : "text-gray-400"}`}>
                            {item.label}
                          </p>
                          {s.updated_at && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {s.updated_by_name ? `${s.updated_by_name} · ` : ""}
                              {new Date(s.updated_at).toLocaleDateString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                              })}
                            </p>
                          )}
                          {s.isDirty && (
                            <span className="text-[10px] text-amber-600 font-semibold">● não salvo</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Ativo toggle */}
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(item.key)}
                        title={s.active ? "Desativar item do menu" : "Ativar item do menu"}
                        className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${
                          s.active ? "bg-green-500" : "bg-gray-300"
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          s.active ? "translate-x-4" : "translate-x-0.5"
                        }`} />
                      </button>
                    </td>

                    {/* Sistema (locked admin+ti) */}
                    <td className="px-3 py-3 text-center border-r">
                      <div className="flex gap-1 justify-center" title="Admin sempre tem acesso completo">
                        <span className="p-1 bg-gray-100 rounded text-gray-400">
                          <Shield size={12} />
                        </span>
                      </div>
                    </td>

                    {/* Editable role cells */}
                    {EDITABLE_ROLES.map(role => {
                      const canView = s.can_view.has(role);
                      const canEdit = s.can_edit.has(role);
                      return (
                        <td key={role} className="px-2 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            {/* View toggle */}
                            <button
                              type="button"
                              onClick={() => toggleView(item.key, role)}
                              title={canView ? `Remover visualização de ${ROLE_LABELS[role]}` : `Dar visualização a ${ROLE_LABELS[role]}`}
                              className={`p-1.5 rounded transition-colors ${
                                canView
                                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                                  : "text-gray-300 hover:text-gray-400 hover:bg-gray-100"
                              }`}
                            >
                              <Eye size={13} />
                            </button>
                            {/* Edit toggle */}
                            <button
                              type="button"
                              onClick={() => toggleEdit(item.key, role)}
                              disabled={!canView}
                              title={
                                !canView ? "Requer visualização primeiro"
                                  : canEdit ? `Remover edição de ${ROLE_LABELS[role]}`
                                  : `Dar edição a ${ROLE_LABELS[role]}`
                              }
                              className={`p-1.5 rounded transition-colors ${
                                !canView
                                  ? "text-gray-200 cursor-not-allowed"
                                  : canEdit
                                    ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                                    : "text-gray-300 hover:text-gray-400 hover:bg-gray-100"
                              }`}
                            >
                              <PenLine size={13} />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <Eye size={12} className="text-blue-500" /> Visualizar
        </span>
        <span className="flex items-center gap-1.5">
          <PenLine size={12} className="text-amber-500" /> Criar / Editar conteúdo
        </span>
        <span className="flex items-center gap-1.5">
          <Shield size={12} className="text-gray-400" /> Admin — acesso fixo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          Linha com alteração não salva
        </span>
        <span className="flex items-center gap-1.5 ml-auto italic">
          Os contadores <Eye size={11} /> e <PenLine size={11} /> no cabeçalho permitem dar/remover acesso a todos os itens de uma vez
        </span>
      </div>

      {/* ──── Preview Dialog ──── */}
      <Dialog open={!!previewRole} onOpenChange={open => !open && setPreviewRole(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Layers size={16} className="text-primary" />
              Menu como &ldquo;{previewRole ? ROLE_LABELS[previewRole] : ""}&rdquo;
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1 mb-2">
            Prévia com alterações ainda não salvas incluídas.
          </p>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {previewRole && (() => {
              let hasAny = false;
              const sections = CATEGORY_ORDER.map(cat => {
                const visible = items
                  .filter(i => i.category === cat && state[i.key]?.active && state[i.key]?.can_view.has(previewRole))
                  .sort((a, b) => a.order_num - b.order_num);
                if (visible.length) hasAny = true;
                return { cat, visible };
              });

              return (
                <>
                  {sections.map(({ cat, visible }) =>
                    visible.length ? (
                      <div key={cat}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 px-2">{cat}</p>
                        <div className="space-y-0.5">
                          {visible.map(item => (
                            <div key={item.key}
                              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                              <span className="text-gray-800">{item.label}</span>
                              {state[item.key]?.can_edit.has(previewRole) && (
                                <span className="text-[10px] text-amber-600 flex items-center gap-0.5 font-medium">
                                  <PenLine size={9} /> edita
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                  {!hasAny && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nenhum item visível para este perfil.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
