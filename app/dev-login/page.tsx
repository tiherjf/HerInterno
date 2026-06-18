"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Shield,
  Wrench,
  Megaphone,
  Users,
  Phone,
  Heart,
  Briefcase,
  UserCircle,
  LogIn,
  Loader2,
} from "lucide-react";

const TEST_USERS = [
  {
    key: "admin",
    label: "Administrador",
    name: "Admin Teste",
    icon: Shield,
    color: "bg-red-100 border-red-300 hover:bg-red-200",
    badge: "bg-red-100 text-red-700",
    description: "Acesso total ao sistema",
    portal: "intranet",
  },
  {
    key: "ti",
    label: "TI",
    name: "Ana TI Teste",
    icon: Wrench,
    color: "bg-purple-100 border-purple-300 hover:bg-purple-200",
    badge: "bg-purple-100 text-purple-700",
    description: "Acesso total + configurações técnicas",
    portal: "intranet",
  },
  {
    key: "marketing",
    label: "Marketing",
    name: "Carlos Marketing",
    icon: Megaphone,
    color: "bg-green-100 border-green-300 hover:bg-green-200",
    badge: "bg-green-100 text-green-700",
    description: "Cria e edita notícias e eventos",
    portal: "intranet",
  },
  {
    key: "rh",
    label: "Recursos Humanos",
    name: "Daniela RH",
    icon: Users,
    color: "bg-yellow-100 border-yellow-300 hover:bg-yellow-200",
    badge: "bg-yellow-100 text-yellow-700",
    description: "Gerencia treinamentos e relatórios",
    portal: "intranet",
  },
  {
    key: "recepcao",
    label: "Recepção",
    name: "Eduardo Recepção",
    icon: Phone,
    color: "bg-blue-100 border-blue-300 hover:bg-blue-200",
    badge: "bg-blue-100 text-blue-700",
    description: "Leitura + inscrições + cadastro de pacientes",
    portal: "intranet",
  },
  {
    key: "enfermagem",
    label: "Enfermagem",
    name: "Fernanda Enfermagem",
    icon: Heart,
    color: "bg-pink-100 border-pink-300 hover:bg-pink-200",
    badge: "bg-pink-100 text-pink-700",
    description: "Leitura + inscrições em eventos",
    portal: "intranet",
  },
  {
    key: "administrativo",
    label: "Administrativo",
    name: "Gustavo Administrativo",
    icon: Briefcase,
    color: "bg-gray-100 border-gray-300 hover:bg-gray-200",
    badge: "bg-gray-100 text-gray-700",
    description: "Leitura + inscrições em eventos",
    portal: "intranet",
  },
  {
    key: "paciente",
    label: "Paciente",
    name: "Maria Paciente Silva",
    icon: UserCircle,
    color: "bg-orange-100 border-orange-300 hover:bg-orange-200",
    badge: "bg-orange-100 text-orange-700",
    description: "Portal do paciente — acesso a exames",
    portal: "pacientes",
  },
];

export default function DevLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Disponível apenas em modo desenvolvimento.</p>
      </div>
    );
  }

  async function login(userKey: string) {
    setLoading(userKey);
    const res = await fetch("/api/dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userKey }),
    });
    const data = await res.json();
    if (data.redirect) {
      router.push(data.redirect);
    }
    setLoading(null);
  }

  const staffUsers = TEST_USERS.filter((u) => u.portal === "intranet");
  const patientUsers = TEST_USERS.filter((u) => u.portal === "pacientes");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <span>⚠️</span> Modo Desenvolvimento — Não usar em produção
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Intranet HER</h1>
          <p className="text-gray-500 mt-1">Hospital Evandro Ribeiro · Selecione um usuário de teste</p>
        </div>

        {/* Colaboradores */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#1e40af] inline-block" />
            Portal dos Colaboradores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {staffUsers.map((user) => {
              const Icon = user.icon;
              return (
                <button
                  key={user.key}
                  onClick={() => login(user.key)}
                  disabled={loading !== null}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors disabled:opacity-50 ${user.color}`}
                >
                  <div className={`p-2 rounded-lg ${user.badge}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800">{user.label}</span>
                      {loading === user.key && (
                        <Loader2 size={14} className="animate-spin text-gray-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{user.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{user.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pacientes */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
            Portal dos Pacientes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patientUsers.map((user) => {
              const Icon = user.icon;
              return (
                <button
                  key={user.key}
                  onClick={() => login(user.key)}
                  disabled={loading !== null}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors disabled:opacity-50 ${user.color}`}
                >
                  <div className={`p-2 rounded-lg ${user.badge}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800">{user.label}</span>
                      {loading === user.key && (
                        <Loader2 size={14} className="animate-spin text-gray-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{user.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{user.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center text-sm text-gray-400">
          <p>Sessão de dev expira em 24h. Para sair, limpe os cookies do navegador ou acesse{" "}
            <a href="/login" className="text-primary hover:underline">login normal</a>.
          </p>
          <p className="mt-1">Esta página não existe em produção (só aparece em {"`"}NODE_ENV=development{"`"}).</p>
        </div>
      </div>
    </div>
  );
}
