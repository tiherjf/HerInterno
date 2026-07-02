export const dynamic = "force-dynamic";
import { requirePatient } from "@/lib/auth/patient";
import { Hospital } from "lucide-react";

export default async function PacientesHome() {
  const patient = await requirePatient();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <Hospital size={32} className="text-primary" />
      </div>
      <h2 className="text-xl font-bold text-gray-800">
        Olá, {patient.name.split(" ")[0]}!
      </h2>
      <p className="text-gray-500 mt-2 max-w-sm">
        O portal do paciente está em desenvolvimento. Em breve novas funcionalidades estarão disponíveis aqui.
      </p>
    </div>
  );
}
