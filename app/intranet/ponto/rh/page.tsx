import { requireStaff } from "@/lib/auth/staff";
import { redirect } from "next/navigation";
import PainelPontoRH from "@/app/admin/ponto/page";

export const dynamic = "force-dynamic";

// Painel de gestão de ponto acessível ao RH: o middleware bloqueia /admin
// para quem não é admin/ti, então o RH acessa o mesmo painel por esta rota.
export default async function PontoRHPage() {
  const profile = await requireStaff();
  if (!["admin", "ti", "rh"].includes(profile.role)) {
    redirect("/intranet/ponto");
  }
  return <PainelPontoRH />;
}
