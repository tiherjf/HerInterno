"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, Upload, ArrowLeft, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface JustificationType {
  id: string;
  name: string;
  requires_document: boolean;
  allows_partial_day: boolean;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const d = result.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return result;
}

function toLocalISO(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export default function NovaJustificativaPage() {
  const router = useRouter();
  const [types, setTypes] = useState<JustificationType[]>([]);
  const [form, setForm] = useState({
    type_id: "",
    occurrence_date: "",
    is_full_day: true,
    start_time: "",
    end_time: "",
    description: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/ponto/tipos")
      .then(r => r.json())
      .then(d => setTypes((d.types || []).filter((t: JustificationType & { active: boolean }) => t.active)));
  }, []);

  const selectedType = types.find(t => t.id === form.type_id);

  const deadline = form.occurrence_date
    ? addBusinessDays(new Date(form.occurrence_date + "T00:00:00"), 3)
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineExpired = deadline ? deadline < today : false;

  async function handleSubmit() {
    if (!form.type_id || !form.occurrence_date || !form.description.trim()) {
      setError("Preencha tipo, data e descrição.");
      return;
    }
    if (deadlineExpired) {
      setError("Prazo de 3 dias úteis já expirou para esta data.");
      return;
    }
    if (!form.is_full_day && (!form.start_time || !form.end_time)) {
      setError("Informe os horários de início e fim.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/ponto/justificativas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_id: form.type_id,
          occurrence_date: form.occurrence_date,
          is_full_day: form.is_full_day,
          start_time: form.is_full_day ? null : form.start_time,
          end_time: form.is_full_day ? null : form.end_time,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao enviar.");
        return;
      }

      // Upload de documento se houver
      if (file && data.justification?.id) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("justification_id", data.justification.id);
        await fetch("/api/ponto/upload", { method: "POST", body: fd }).catch(() => {});
      }

      setSuccess(true);
      setTimeout(() => router.push("/intranet/ponto/justificativas"), 2000);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <CheckCircle2 size={56} className="text-green-500 mx-auto" />
        <h2 className="text-xl font-bold">Justificativa enviada!</h2>
        <p className="text-muted-foreground">
          Aguarde a aprovação do seu gestor. Você será informado quando houver atualização.
        </p>
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/intranet/ponto">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Voltar</Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Nova Justificativa</h2>
          <p className="text-muted-foreground">Prazo: até 3 dias úteis após a ocorrência</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Ocorrência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de Justificativa *</Label>
            <Select
              value={form.type_id}
              onValueChange={(v) => setForm({ ...form, type_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {types.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label>Data da Ocorrência *</Label>
            <Input
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={form.occurrence_date}
              onChange={(e) => setForm({ ...form, occurrence_date: e.target.value })}
            />
            {deadline && (
              <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                deadlineExpired
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                <Info size={12} />
                {deadlineExpired
                  ? "Prazo expirado — não é possível justificar esta data."
                  : `Prazo para justificar: até ${toLocalISO(deadline)}.`
                }
              </div>
            )}
          </div>

          {/* Período */}
          {selectedType?.allows_partial_day && (
            <div className="space-y-3">
              <Label>Período</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm"
                  variant={form.is_full_day ? "default" : "outline"}
                  onClick={() => setForm({ ...form, is_full_day: true })}>
                  Dia todo
                </Button>
                <Button type="button" size="sm"
                  variant={!form.is_full_day ? "default" : "outline"}
                  onClick={() => setForm({ ...form, is_full_day: false })}>
                  Horário específico
                </Button>
              </div>
              {!form.is_full_day && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input type="time" value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Input type="time" value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Motivo / Descrição *</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva o motivo detalhadamente. Quanto mais informações, maior a chance de aprovação."
              rows={4}
            />
          </div>

          {/* Anexo */}
          <div className="space-y-2">
            <Label>
              Comprovante / Atestado
              {selectedType?.requires_document && (
                <span className="text-red-500 ml-1">* (obrigatório para este tipo)</span>
              )}
            </Label>
            <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <Upload size={20} className="text-muted-foreground" />
              <div className="flex-1 min-w-0">
                {file ? (
                  <p className="text-sm font-medium truncate">{file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Clique para anexar PDF, JPG ou PNG (máx. 5MB)
                  </p>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Link href="/intranet/ponto" className="flex-1">
              <Button variant="outline" className="w-full">Cancelar</Button>
            </Link>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || deadlineExpired}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "Enviar Justificativa"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
