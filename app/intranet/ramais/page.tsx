import { requireStaff } from "@/lib/auth/staff";
import { getRamaisData } from "@/lib/ramais/server";
import RamaisTela from "./RamaisTela";

export default async function RamaisPage({ searchParams }: { searchParams: { q?: string } }) {
  const profile = await requireStaff();
  const { setores, meu_ramal } = await getRamaisData(profile);
  return <RamaisTela initialSetores={setores} initialMeuRamal={meu_ramal} initialQ={searchParams.q ?? ""} />;
}
