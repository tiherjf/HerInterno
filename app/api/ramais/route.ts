import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const [{ data: setores }, { data: ramais }, { data: favs }] = await Promise.all([
      supabase.from("ramal_setores").select("id, name, icon, color, order_index").eq("active", true).order("order_index"),
      supabase.from("ramais").select("id, setor_id, numero, descricao, order_index").eq("active", true).order("order_index"),
      supabase.from("ramal_favoritos").select("ramal_id").eq("user_id", profile.id),
    ]);

    const favSet = new Set((favs ?? []).map(f => f.ramal_id));

    const setoresComRamais = (setores ?? []).map(s => ({
      ...s,
      ramais: (ramais ?? [])
        .filter(r => r.setor_id === s.id)
        .map(r => ({ ...r, favorito: favSet.has(r.id) })),
    }));

    return NextResponse.json({
      setores: setoresComRamais,
      meu_ramal: profile.phone_ext ?? null,
    });
  } catch (err) {
    return apiError(err);
  }
}
