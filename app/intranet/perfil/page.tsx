"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, Save, Lock, User, Building, Phone, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils";

interface PerfilData {
  id: string;
  full_name: string;
  role: string;
  sector: string | null;
  unit: string | null;
  phone_ext: string | null;
  avatar_url: string | null;
}

type Msg = { text: string; ok: boolean } | null;

function feedback(set: (m: Msg) => void, text: string, ok: boolean) {
  set({ text, ok });
  setTimeout(() => set(null), 4000);
}

export default function PerfilPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [nome, setNome] = useState("");
  const [ramal, setRamal] = useState("");
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [msgPerfil, setMsgPerfil] = useState<Msg>(null);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [msgPwd, setMsgPwd] = useState<Msg>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((d: PerfilData) => {
        setPerfil(d);
        setNome(d.full_name ?? "");
        setRamal(d.phone_ext ?? "");
      });
  }, []);

  async function handleSavePerfil() {
    setSavingPerfil(true);
    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: nome, phone_ext: ramal }),
    });
    setSavingPerfil(false);
    if (res.ok) {
      setPerfil((p) => p ? { ...p, full_name: nome, phone_ext: ramal } : p);
      feedback(setMsgPerfil, "Dados salvos com sucesso!", true);
    } else {
      feedback(setMsgPerfil, "Erro ao salvar. Tente novamente.", false);
    }
  }

  async function handleChangePwd() {
    if (novaSenha !== confirmarSenha) {
      feedback(setMsgPwd, "As senhas não coincidem.", false);
      return;
    }
    if (novaSenha.length < 6) {
      feedback(setMsgPwd, "Senha deve ter pelo menos 6 caracteres.", false);
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSavingPwd(false);
    if (error) {
      feedback(setMsgPwd, "Erro: " + error.message, false);
    } else {
      setNovaSenha("");
      setConfirmarSenha("");
      feedback(setMsgPwd, "Senha alterada com sucesso!", true);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch("/api/perfil/avatar", { method: "POST", body: form });
    setUploadingAvatar(false);

    if (res.ok) {
      const { avatar_url } = await res.json();
      setPerfil((p) => p ? { ...p, avatar_url } : p);
    }
  }

  const initials = perfil?.full_name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  const displayAvatar = avatarPreview ?? perfil?.avatar_url;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Meu Perfil</h2>
        <p className="text-muted-foreground">Gerencie seus dados e acesso ao sistema</p>
      </div>

      {/* Avatar + identidade */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <div
                className="w-20 h-20 rounded-full brand-gradient flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
                title="Clique para alterar foto"
              >
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">{initials}</span>
                )}
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full p-0 shadow-sm border-2 border-background"
              >
                {uploadingAvatar ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Camera size={12} />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{perfil?.full_name ?? "..."}</p>
              {perfil?.role && (
                <Badge className={`text-xs border-0 mt-1 ${ROLE_COLORS[perfil.role] ?? "bg-gray-100 text-gray-800"}`}>
                  {ROLE_LABELS[perfil.role] ?? perfil.role}
                </Badge>
              )}
              {perfil?.sector && (
                <p className="text-sm text-muted-foreground mt-1">{perfil.sector}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User size={16} /> Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Phone size={12} /> Ramal
              </Label>
              <Input
                value={ramal}
                onChange={(e) => setRamal(e.target.value)}
                placeholder="Ex: 1234"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building size={12} /> Setor
              </Label>
              <Input
                value={perfil?.sector ?? "—"}
                disabled
                className="bg-gray-50 text-muted-foreground"
              />
            </div>
          </div>
          {msgPerfil && (
            <Alert variant={msgPerfil.ok ? "success" : "destructive"}>
              <AlertDescription>{msgPerfil.text}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSavePerfil} disabled={savingPerfil}>
              {savingPerfil ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {savingPerfil ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock size={16} /> Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
            />
          </div>
          {msgPwd && (
            <Alert variant={msgPwd.ok ? "success" : "destructive"}>
              <AlertDescription>{msgPwd.text}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleChangePwd}
              disabled={savingPwd || !novaSenha}
            >
              {savingPwd ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              {savingPwd ? "Alterando..." : "Alterar senha"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
