"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

export default function NovaSenhaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Supabase populates session from URL hash after email link click
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setError("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/intranet"), 2500);
    }
  }

  return (
    <AuthShell subtitle="Redefinição de senha">
        <Card className="shadow-2xl">
          {done ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={20} /> Senha redefinida!
                </CardTitle>
                <CardDescription>
                  Sua senha foi alterada com sucesso. Redirecionando para a intranet...
                </CardDescription>
              </CardHeader>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock size={18} /> Nova senha
                </CardTitle>
                <CardDescription>
                  Escolha uma senha segura para sua conta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!ready && !error ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={24} className="animate-spin text-primary" />
                  </div>
                ) : error && !ready ? (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 p-3 rounded-md">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nova senha</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar nova senha</Label>
                      <Input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repita a nova senha"
                        required
                        autoComplete="new-password"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 p-3 rounded-md">
                        <AlertCircle size={16} />
                        {error}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                      ) : (
                        "Redefinir senha"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}
        </Card>
    </AuthShell>
  );
}
