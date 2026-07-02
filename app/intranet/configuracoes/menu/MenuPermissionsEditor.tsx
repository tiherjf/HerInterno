"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ALL_ROLES, ROLE_LABELS, CATEGORY_ORDER } from "@/lib/menu/types";
import type { MenuItemConfig, StaffRole } from "@/lib/menu/types";
import {
  Eye,
  Pencil,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface Props {
  items: MenuItemConfig[];
}

interface ItemState {
  can_view: Set<StaffRole>;
  can_edit: Set<StaffRole>;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

export function MenuPermissionsEditor({ items }: Props) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.key,
        {
          can_view: new Set(item.can_view as StaffRole[]),
          can_edit: new Set(item.can_edit as StaffRole[]),
          saving: false,
          saved: false,
          error: null,
        },
      ])
    )
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggle(
    key: string,
    type: "can_view" | "can_edit",
    role: StaffRole
  ) {
    // admin e ti são imutáveis
    if (role === "admin" || role === "ti") return;

    setState((prev) => {
      const item = { ...prev[key] };
      const set = new Set(item[type]);

      if (set.has(role)) {
        set.delete(role);
        // Se removeu de can_view, remove também de can_edit
        if (type === "can_view") {
          item.can_edit = new Set(
            Array.from(item.can_edit).filter((r) => r !== role)
          );
        }
      } else {
        set.add(role);
        // Se adicionou em can_edit, adiciona em can_view automaticamente
        if (type === "can_edit") {
          item.can_view = new Set(Array.from(item.can_view).concat(role));
        }
      }

      item[type] = set;
      item.saved = false;
      item.error = null;
      return { ...prev, [key]: item };
    });
  }

  async function save(key: string) {
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], saving: true, error: null },
    }));

    const { can_view, can_edit } = state[key];

    const res = await fetch("/api/menu/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        can_view: Array.from(can_view),
        can_edit: Array.from(can_edit),
      }),
    });

    const data = await res.json();

    setState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        saving: false,
        saved: res.ok,
        error: res.ok ? null : (data.error ?? "Erro ao salvar"),
      },
    }));

    if (res.ok) {
      setTimeout(
        () =>
          setState((prev) => ({
            ...prev,
            [key]: { ...prev[key], saved: false },
          })),
        2500
      );
    }
  }

  // Agrupar por categoria
  const grouped: { category: string; items: MenuItemConfig[] }[] =
    CATEGORY_ORDER.map((cat) => ({
      category: cat as string,
      items: items
        .filter((i) => i.category === cat)
        .sort((a, b) => a.order_num - b.order_num),
    })).filter((g) => g.items.length > 0);

  const knownCategories = new Set<string>(CATEGORY_ORDER);
  const extraItems = items.filter((i) => !knownCategories.has(i.category));
  if (extraItems.length > 0) {
    grouped.push({ category: "Outros" as string, items: extraItems });
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ category, items: catItems }) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary inline-block" />
            {category}
          </h3>

          <div className="space-y-3">
            {catItems.map((item) => {
              const s = state[item.key];
              const isOpen = expanded.has(item.key);

              return (
                <Card key={item.key} className="overflow-hidden">
                  {/* Cabeçalho do item */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => toggleExpanded(item.key)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-800">
                        {item.label}
                      </span>
                      {/* Resumo compacto */}
                      <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {Array.from(s.can_view)
                            .map((r) => ROLE_LABELS[r])
                            .join(", ")}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1">
                          <Pencil size={12} />
                          {Array.from(s.can_edit)
                            .map((r) => ROLE_LABELS[r])
                            .join(", ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.saved && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Check size={13} /> Salvo
                        </span>
                      )}
                      {s.error && (
                        <span className="text-xs text-red-500">{s.error}</span>
                      )}
                      {isOpen ? (
                        <ChevronUp size={18} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Painel expandido */}
                  {isOpen && (
                    <CardContent className="border-t px-5 py-4 space-y-5">
                      {/* Visibilidade */}
                      <div>
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
                          <Eye size={15} className="text-blue-500" />
                          Quem pode visualizar
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ALL_ROLES.map((role) => {
                            const locked = role === "admin" || role === "ti";
                            const active = s.can_view.has(role);
                            return (
                              <button
                                key={role}
                                onClick={() =>
                                  toggle(item.key, "can_view", role)
                                }
                                disabled={locked}
                                title={
                                  locked
                                    ? "Admin e TI sempre têm acesso"
                                    : undefined
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                  locked
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                    : active
                                    ? "bg-blue-100 text-blue-700 border-blue-300"
                                    : "bg-white text-gray-500 border-gray-300 hover:border-blue-300"
                                }`}
                              >
                                {locked && (
                                  <ShieldAlert size={11} className="opacity-60" />
                                )}
                                {ROLE_LABELS[role]}
                                {active && !locked && (
                                  <Check size={11} className="text-blue-600" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Edição */}
                      <div>
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
                          <Pencil size={15} className="text-amber-500" />
                          Quem pode criar / editar conteúdo
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ALL_ROLES.map((role) => {
                            const locked = role === "admin" || role === "ti";
                            const active = s.can_edit.has(role);
                            const canSee = s.can_view.has(role);
                            return (
                              <button
                                key={role}
                                onClick={() =>
                                  toggle(item.key, "can_edit", role)
                                }
                                disabled={locked || !canSee}
                                title={
                                  locked
                                    ? "Admin e TI sempre têm acesso"
                                    : !canSee
                                    ? "Perfil sem visibilidade nesta seção"
                                    : undefined
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                  locked
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                    : !canSee
                                    ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                                    : active
                                    ? "bg-amber-100 text-amber-700 border-amber-300"
                                    : "bg-white text-gray-500 border-gray-300 hover:border-amber-300"
                                }`}
                              >
                                {locked && (
                                  <ShieldAlert size={11} className="opacity-60" />
                                )}
                                {ROLE_LABELS[role]}
                                {active && !locked && (
                                  <Check size={11} className="text-amber-600" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Apenas perfis com visibilidade podem receber permissão
                          de edição.
                        </p>
                      </div>

                      {/* Botão salvar */}
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          onClick={() => save(item.key)}
                          disabled={s.saving}
                        >
                          {s.saving ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            "Salvar alterações"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
