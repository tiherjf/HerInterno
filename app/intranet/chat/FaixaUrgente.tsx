import { AlertTriangle, X } from "lucide-react";

/** Faixa vermelha no topo da conversa enquanto há chamada urgente sem resposta. */
export function FaixaUrgente({ primeiroNome, motivo, onFechar }: {
  primeiroNome: string;
  motivo: string;
  onFechar: () => void;
}) {
  return (
    <div role="alert" className="flex items-start gap-2 bg-red-600 px-3 py-2 text-sm text-white">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 break-words">
        <span className="font-semibold">Chamada urgente de {primeiroNome}:</span> {motivo}
      </p>
      <button
        type="button"
        onClick={onFechar}
        className="rounded p-0.5 text-white/80 hover:bg-white/15 hover:text-white"
        aria-label="Fechar aviso de urgência"
      >
        <X size={15} />
      </button>
    </div>
  );
}
