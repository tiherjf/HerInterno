import { requireStaff } from "@/lib/auth/staff";
import { getProfissionais } from "@/lib/corpo-clinico/server";
import type { Profissional } from "@/lib/corpo-clinico/types";
import { termoDaUrl } from "@/lib/ui/query";
import CorpoClinicoTela from "./CorpoClinicoTela";

export default async function CorpoClinicoPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  await requireStaff();
  const profissionais = (await getProfissionais()) as Profissional[];
  const q = termoDaUrl(searchParams.q);
  return <CorpoClinicoTela key={q} initialProfissionais={profissionais} initialQ={q} />;
}
