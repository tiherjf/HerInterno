import type { Status } from "@/lib/chat-interno/tipos";
import { iniciais } from "@/lib/chat-interno/formato";

export const STATUS_META: Record<Status, { label: string; dot: string }> = {
  disponivel: { label: "Disponível", dot: "bg-green-500" },
  ausente: { label: "Ausente", dot: "bg-yellow-400" },
  ocupado: { label: "Ocupado", dot: "bg-red-500" },
};
export const OFFLINE_DOT = "bg-slate-300";

/** Avatar com iniciais e bolinha de presença. */
export function Avatar({ nome, status, offlineLabel, tamanho = "md" }: {
  nome: string;
  status: Status | null;
  offlineLabel: string;
  tamanho?: "md" | "lg";
}) {
  const caixa = tamanho === "lg" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";
  return (
    <div className="relative shrink-0">
      <div className={`flex items-center justify-center rounded-full bg-accent font-semibold text-primary ${caixa}`}>
        {iniciais(nome)}
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
          status ? STATUS_META[status].dot : OFFLINE_DOT
        }`}
        title={status ? STATUS_META[status].label : offlineLabel}
      />
    </div>
  );
}
