export const dynamic = "force-dynamic";
import { requirePatient } from "@/lib/auth/patient";
import { HeartPulse, LogOut } from "lucide-react";

export default async function PacientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const patient = await requirePatient();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header simples para paciente */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HeartPulse size={28} />
            <div>
              <p className="font-bold text-sm leading-tight">Hospital Evandro Ribeiro</p>
              <p className="text-primary-foreground/60 text-xs">Portal do Paciente</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{patient.name}</p>
              <p className="text-primary-foreground/60 text-xs">Paciente</p>
            </div>
            <form action="/api/patients/logout" method="POST">
              <button
                type="submit"
                className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors"
                title="Sair"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>

      <footer className="text-center py-6 text-sm text-gray-500 border-t mt-8">
        Hospital Evandro Ribeiro · Juiz de Fora, MG · Suporte: recepção do hospital
      </footer>
    </div>
  );
}
