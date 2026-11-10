import { requireStaff } from "@/lib/auth/staff";
import { getRamaisData } from "@/lib/ramais/server";
import RamaisView from "./RamaisView";

export default async function RamaisPage() {
  const profile = await requireStaff();
  const { setores, meu_ramal } = await getRamaisData(profile);
  return <RamaisView initialSetores={setores} initialMeuRamal={meu_ramal} />;
}
