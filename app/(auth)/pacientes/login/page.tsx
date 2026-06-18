"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, HeartPulse } from "lucide-react";
import { formatCPF, cleanCPF } from "@/lib/utils";

export default function PatientLoginPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleCPFChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = cleanCPF(e.target.value);
    if (raw.length <= 11) {
      setCpf(raw.length === 11 ? formatCPF(raw) : raw);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/patients/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: cleanCPF(cpf), password }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "CPF ou senha incorretos.");
      setLoading(false);
      return;
    }

    router.push("/pacientes");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#1e40af] rounded-2xl shadow-lg mb-4">
            <HeartPulse size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Hospital Evandro Ribeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Portal do Paciente — Acesso aos seus exames</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Acesso ao Portal</CardTitle>
            <CardDescription className="text-base">
              Entre com seu CPF e a senha fornecida pelo hospital
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-base">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCPFChange}
                  required
                  className="text-lg h-12"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-base">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Senha fornecida pelo hospital"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-lg h-12"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 p-3 rounded-md">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Entrando...
                  </>
                ) : (
                  "Acessar meus exames"
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">Como obter sua senha?</p>
              <p className="text-sm text-blue-700 mt-1">
                Sua senha foi gerada automaticamente no dia do exame e fornecida pela recepção.
                Em caso de dúvidas, procure o balcão de atendimento.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-center text-muted-foreground">
                É colaborador?{" "}
                <a href="/login" className="text-primary hover:underline font-medium">
                  Acesse a intranet
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
