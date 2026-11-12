import { requireStaff } from "@/lib/auth/staff";
import { getProcedimentos } from "@/lib/procedimentos/server";
import type { StaffRole } from "@/lib/menu/types";
import type { Procedimento } from "@/lib/procedimentos/types";
import ProcedimentosTela from "./ProcedimentosTela";

export default async function ProcedimentosPage({ searchParams }: { searchParams: { q?: string } }) {
  const profile = await requireStaff();
  const items = (await getProcedimentos(profile.role as StaffRole)) as Procedimento[];
  return <ProcedimentosTela initialItems={items} initialQ={searchParams.q ?? ""} />;
}
