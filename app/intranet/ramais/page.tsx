import { requireStaff } from "@/lib/auth/staff";
import { getRamaisData } from "@/lib/ramais/server";
import { termoDaUrl } from "@/lib/ui/query";
import RamaisTela from "./RamaisTela";

export default async function RamaisPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  const profile = await requireStaff();
  const { setores, meu_ramal } = await getRamaisData(profile);
  const q = termoDaUrl(searchParams.q);
  return <RamaisTela key={q} initialSetores={setores} initialMeuRamal={meu_ramal} initialQ={q} />;
}
