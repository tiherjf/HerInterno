import { unstable_cache } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Tag do cache da lista de ramais — invalidada nas rotas que alteram setores/ramais */
export const RAMAIS_CACHE_TAG = "ramais";

export interface RamalItem {
  id: string;
  setor_id: string;
  numero: string;
  descricao: string;
  order_index: number;
  favorito: boolean;
}

export interface RamalSetor {
  id: string;
  name: string;
  icon: string;
  color: string;
  order_index: number;
  ramais: RamalItem[];
}

export interface RamaisData {
  setores: RamalSetor[];
  meu_ramal: string | null;
}

// Setores e ramais são iguais para todos → cache entre requisições.
// Service client porque o cache não pode depender de cookies.
// O revalidate cobre alterações feitas fora da API (scripts de seed).
const fetchListaRamais = unstable_cache(
  async () => {
    const svc = createServiceClient();
    const [{ data: setores }, { data: ramais }] = await Promise.all([
      svc.from("ramal_setores").select("id, name, icon, color, order_index").eq("active", true).order("order_index"),
      svc.from("ramais").select("id, setor_id, numero, descricao, order_index").eq("active", true).order("order_index"),
    ]);
    return { setores: setores ?? [], ramais: ramais ?? [] };
  },
  ["ramais-lista"],
  { tags: [RAMAIS_CACHE_TAG], revalidate: 300 }
);

/** Lista de ramais por setor com os favoritos do usuário marcados. */
export async function getRamaisData(profile: { id: string; phone_ext?: string | null }): Promise<RamaisData> {
  const [{ setores, ramais }, { data: favs }] = await Promise.all([
    fetchListaRamais(),
    createClient().from("ramal_favoritos").select("ramal_id").eq("user_id", profile.id),
  ]);

  const favSet = new Set((favs ?? []).map((f: { ramal_id: string }) => f.ramal_id));

  return {
    setores: setores.map(s => ({
      ...s,
      ramais: ramais
        .filter(r => r.setor_id === s.id)
        .map(r => ({ ...r, favorito: favSet.has(r.id) })),
    })) as RamalSetor[],
    meu_ramal: profile.phone_ext ?? null,
  };
}
