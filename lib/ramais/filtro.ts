/** Regras puras da lista de ramais. */
import type { RamalSetor } from "./server";
import { normalizarTexto } from "../../components/corpo-clinico/agenda";

export interface FiltroRamais {
  busca: string;
  setorId: string | null;
  apenasFavoritos: boolean;
}

/** Ramal com número de verdade ("N/A" e vazio não podem ser copiados). */
export function temNumero(numero: string): boolean {
  const n = numero.trim();
  return n !== "" && n.toUpperCase() !== "N/A";
}

/**
 * Filtra setores e ramais. A busca (sem acento e sem caixa) olha o número,
 * a descrição e o nome do setor. Setores sem ramais restantes saem.
 */
export function filtrarRamais(setores: RamalSetor[], f: FiltroRamais): RamalSetor[] {
  const termo = normalizarTexto(f.busca).trim();
  const contem = (v: string) => normalizarTexto(v).includes(termo);
  return setores
    .filter((s) => f.setorId === null || s.id === f.setorId)
    .map((s) => {
      const setorCasa = termo !== "" && contem(s.name);
      return {
        ...s,
        ramais: s.ramais.filter((r) => {
          if (f.apenasFavoritos && !r.favorito) return false;
          if (!termo) return true;
          return setorCasa || contem(r.numero) || contem(r.descricao);
        }),
      };
    })
    .filter((s) => s.ramais.length > 0);
}
