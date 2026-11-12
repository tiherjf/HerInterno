import type { ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

/** Caixa branca de um setor (ou de Favoritos), com as linhas de ramal dentro. */
export function SetorCaixa({ titulo, quantidade, icone, acoesAdmin, children }: {
  titulo: string;
  quantidade: number;
  icone?: ReactNode;
  acoesAdmin?: { onAdicionar: () => void; onEditar: () => void; onRemover: () => void };
  children: ReactNode;
}) {
  return (
    <section className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {icone}
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        <span className="text-xs text-slate-500">{quantidade}</span>
        {acoesAdmin && (
          <span className="ml-auto flex gap-0.5 no-print">
            <button type="button" onClick={acoesAdmin.onAdicionar} title="Adicionar ramal" aria-label={`Adicionar ramal em ${titulo}`}
              className="rounded-md p-1.5 text-slate-400 hover:bg-accent hover:text-primary">
              <Plus size={14} />
            </button>
            <button type="button" onClick={acoesAdmin.onEditar} title="Editar setor" aria-label={`Editar setor ${titulo}`}
              className="rounded-md p-1.5 text-slate-400 hover:bg-accent hover:text-primary">
              <Pencil size={14} />
            </button>
            <button type="button" onClick={acoesAdmin.onRemover} title="Remover setor" aria-label={`Remover setor ${titulo}`}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </header>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}
