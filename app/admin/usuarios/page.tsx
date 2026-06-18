"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, UserX, UserCheck, Loader2, Search } from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils";

interface User {
  id: string;
  full_name: string;
  role: string;
  sector: string;
  unit: string;
  phone_ext: string;
  active: boolean;
  email?: string;
}

const ROLES = ["admin", "ti", "marketing", "rh", "recepcao", "enfermagem", "administrativo"];

export default function UsuariosPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "",
    sector: "",
    unit: "Matriz",
    phone_ext: "",
    password: "",
  });

  async function fetchUsers() {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("*")
      .order("full_name");

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,sector.ilike.%${search}%`);
    }

    const { data } = await query;
    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function openCreateDialog() {
    setEditUser(null);
    setForm({ email: "", full_name: "", role: "", sector: "", unit: "Matriz", phone_ext: "", password: "" });
    setDialogOpen(true);
  }

  function openEditDialog(user: User) {
    setEditUser(user);
    setForm({
      email: user.email || "",
      full_name: user.full_name,
      role: user.role,
      sector: user.sector || "",
      unit: user.unit || "Matriz",
      phone_ext: user.phone_ext || "",
      password: "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editUser) {
      await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          role: form.role,
          sector: form.sector,
          unit: form.unit,
          phone_ext: form.phone_ext,
        })
        .eq("id", editUser.id);
    } else {
      // Criar via API route para segurança
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setDialogOpen(false);
    fetchUsers();
    setSaving(false);
  }

  async function toggleActive(user: User) {
    await supabase
      .from("profiles")
      .update({ active: !user.active })
      .eq("id", user.id);
    fetchUsers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usuários Colaboradores</h2>
          <p className="text-muted-foreground">{users.length} usuário(s) encontrado(s)</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus size={16} /> Novo Usuário
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou setor..."
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
                <TableHead>Perfil</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Ramal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.sector || "—"}</TableCell>
                  <TableCell className="text-sm">{user.phone_ext || "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {user.active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleActive(user)}
                        className={user.active ? "text-red-500 hover:text-red-700" : "text-green-500 hover:text-green-700"}
                      >
                        {user.active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editUser && (
              <>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="colaborador@hospital.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha inicial *</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Senha para primeiro acesso"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Perfil *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Input
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  placeholder="Ex: UTI, Recepção"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ramal</Label>
                <Input
                  value={form.phone_ext}
                  onChange={(e) => setForm({ ...form, phone_ext: e.target.value })}
                  placeholder="Ex: 1234"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
