"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, RefreshCw, Loader2 } from "lucide-react";
import { formatDate, formatCPF, cleanCPF } from "@/lib/utils";

interface Patient {
  id: string;
  cpf: string;
  full_name: string;
  birth_date: string;
  created_at: string;
}

export default function PacientesAdminPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [form, setForm] = useState({
    cpf: "",
    full_name: "",
    birth_date: "",
    password: "",
  });

  async function fetchPatients() {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/admin/patients${params}`);
    const data = await res.json();
    setPatients(data.patients || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => fetchPatients(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function openCreateDialog() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const suggestedPassword = `${dd}${mm}`;
    setGeneratedPassword(suggestedPassword + "XXXX (completar com 4 últimos dígitos do CPF)");
    setForm({ cpf: "", full_name: "", birth_date: "", password: "" });
    setDialogOpen(true);
  }

  function handleCPFChange(val: string) {
    const cleaned = cleanCPF(val);
    if (cleaned.length <= 11) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const last4 = cleaned.slice(-4).padStart(4, "0");
      const autoPass = cleaned.length === 11 ? `${dd}${mm}${last4}` : "";
      setForm((f) => ({ ...f, cpf: val, password: autoPass }));
      if (cleaned.length === 11) {
        setGeneratedPassword(`Senha gerada: ${dd}${mm}${last4}`);
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/admin/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, cpf: cleanCPF(form.cpf) }),
    });
    setSaving(false);
    if (res.ok) {
      setDialogOpen(false);
      fetchPatients();
    } else {
      const data = await res.json();
      alert(data.error || "Erro ao salvar paciente");
    }
  }

  async function resetPassword(patientId: string) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const patient = patients.find((p) => p.id === patientId);
    const last4 = patient ? cleanCPF(patient.cpf).slice(-4) : "0000";
    const newPass = `${dd}${mm}${last4}`;

    if (!confirm(`Redefinir senha para: ${newPass}?`)) return;

    await fetch(`/api/admin/patients/${patientId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPass }),
    });
    alert(`Senha redefinida para: ${newPass}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pacientes</h2>
          <p className="text-muted-foreground">{patients.length} paciente(s) cadastrado(s)</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus size={16} /> Novo Paciente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Data de Nascimento</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="font-mono text-sm">{formatCPF(p.cpf)}</TableCell>
                  <TableCell>{p.birth_date ? formatDate(p.birth_date) : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(p.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resetPassword(p.id)}
                      title="Redefinir senha"
                    >
                      <RefreshCw size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {patients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum paciente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input
                value={form.cpf}
                onChange={(e) => handleCPFChange(e.target.value)}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nome completo do paciente"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha inicial</Label>
              <Input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Senha para o paciente"
              />
              {generatedPassword && (
                <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                  {generatedPassword}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
