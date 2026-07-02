"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Hospital, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/nova-senha`
        : "/nova-senha";

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);

    if (error) {
      setError("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <Hospital size={40} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Hospital Evandro Ribeiro</h1>
          <p className="text-zinc-400 text-sm mt-1">Recuperação de senha</p>
        </div>

        <Card className="shadow-2xl">
          {sent ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={20} /> E-mail enviado!
                </CardTitle>
                <CardDescription>
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha. O link expira em 1 hora.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft size={15} /> Voltar ao login
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Esqueceu sua senha?</CardTitle>
                <CardDescription>
                  Informe seu e-mail institucional. Enviaremos um link para redefinir sua senha.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail institucional</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@hospitalevandroribeiro.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
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
                      <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    ) : (
                      "Enviar link de recuperação"
                    )}
                  </Button>

                  <Link href="/login" className="block text-center">
                    <button type="button" className="text-sm text-muted-foreground hover:text-foreground">
                      <ArrowLeft size={13} className="inline mr-1" />
                      Voltar ao login
                    </button>
                  </Link>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
