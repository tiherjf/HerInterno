import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { QualidadeView } from "./_components/QualidadeView";
import type { Setor } from "./_components/QualidadeView";

export const metadata = { title: "Qualidade" };

export default async function QualidadePage() {
  const user = await requireStaff();
  const isAdmin = ["admin", "ti", "qualidade", "rh"].includes(user.role ?? "");

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("quality_sectors")
    .select("id, name, color, description, active")
    .order("order_num", { ascending: true });

  const setores: Setor[] = (data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    color: s.color,
    description: s.description,
    active: s.active,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <QualidadeView isAdmin={isAdmin} setores={setores} />
    </div>
  );
}
