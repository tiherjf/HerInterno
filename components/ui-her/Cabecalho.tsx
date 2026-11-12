import type { ReactNode } from "react";

/** Cabeçalho de página no estilo A2: título, linha cinza e ações à direita. */
export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{titulo}</h1>
        {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2 no-print">{acoes}</div>}
    </div>
  );
}
