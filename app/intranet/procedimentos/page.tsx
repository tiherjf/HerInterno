import { requireStaff } from "@/lib/auth/staff";
import { getProcedimentos } from "@/lib/procedimentos/server";
import type { StaffRole } from "@/lib/menu/types";
import ProcedimentosView, { type Procedimento } from "./ProcedimentosView";

export default async function ProcedimentosPage() {
  const profile = await requireStaff();
  const items = (await getProcedimentos(profile.role as StaffRole)) as Procedimento[];
  return <ProcedimentosView initialItems={items} />;
}
