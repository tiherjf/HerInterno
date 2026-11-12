import { requireStaff } from "@/lib/auth/staff";
import { getProfissionais } from "@/lib/corpo-clinico/server";
import type { Profissional } from "@/lib/corpo-clinico/types";
import CorpoClinicoTela from "./CorpoClinicoTela";

export default async function CorpoClinicoPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireStaff();
  const profissionais = (await getProfissionais()) as Profissional[];
  return <CorpoClinicoTela initialProfissionais={profissionais} initialQ={searchParams.q ?? ""} />;
}
