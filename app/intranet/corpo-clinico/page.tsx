import { requireStaff } from "@/lib/auth/staff";
import { getProfissionais } from "@/lib/corpo-clinico/server";
import CorpoClinicoView, { type Profissional } from "./CorpoClinicoView";

export default async function CorpoClinicoPage() {
  await requireStaff();
  const profissionais = (await getProfissionais()) as Profissional[];
  return <CorpoClinicoView initialProfissionais={profissionais} />;
}
