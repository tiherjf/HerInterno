"use client";

import { Check, Copy, Pencil, Star, Trash2 } from "lucide-react";
import type { RamalItem } from "@/lib/ramais/server";
import { temNumero } from "@/lib/ramais/filtro";

/** Um ramal por linha: número grande, descrição inteira, favorito, copiar e ações de admin. */
export function RamalLinha({ ramal, isAdmin, copiado, onCopiar, onFavorito, onEditar, onRemover }: {
  ramal: RamalItem;
  isAdmin: boolean;
  copiado: boolean;
  onCopiar: () => void;
  onFavorito: () => void;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const comNumero = temNumero(ramal.numero);
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
      <span
        className={`min-w-14 shrink-0 text-lg font-bold tabular-nums ${comNumero ? "text-primary" : "text-slate-300"}`}
      >
        {comNumero ? ramal.numero : "—"}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug text-slate-800 wrap-break-word">{ramal.descricao}</span>

      <span className="flex shrink-0 items-center gap-0.5 no-print">
        <button
          type="button"
          onClick={onFavorito}
          title={ramal.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-label={ramal.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className={`rounded-md p-1.5 transition-colors ${
            ramal.favorito
              ? "text-amber-500"
              : "text-slate-300 hover:text-amber-400 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
          }`}
        >
          <Star size={15} className={ramal.favorito ? "fill-amber-400" : ""} />
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={onEditar}
              aria-label="Editar ramal"
              className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onRemover}
              aria-label="Remover ramal"
              className="rounded-md p-1.5 text-slate-400 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
        {comNumero && (
          <button
            type="button"
            onClick={onCopiar}
            title="Copiar ramal"
            aria-label={`Copiar ramal ${ramal.numero}`}
            className={`rounded-md border p-1.5 transition-colors ${
              copiado ? "border-green-200 bg-green-50 text-green-600" : "border-border bg-white text-primary hover:bg-accent"
            }`}
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </span>
    </li>
  );
}
