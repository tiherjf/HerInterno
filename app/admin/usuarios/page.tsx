"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  UserX,
  UserCheck,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface User {
  id: string;
  full_name: string;
  role: string;
  sector: string;
  unit: string;
  phone_ext: string;
  active: boolean;
  is_manager: boolean;
  manager_id: string | null;
  email?: string;
}

const ROLES = [
  "admin",
  "ti",
  "marketing",
  "rh",
  "recepcao",
  "enfermagem",
  "administrativo",
];

const EMPTY_FORM = {
  email: "",
  full_name: "",
  role: "",
  sector: "",
  unit: "Matriz",
  phone_ext: "",
  password: "",
  is_manager: false,
  manager_id: "",
};

export default function UsuariosPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, sector, unit, phone_ext, active, is_manager, manager_id")
      .order("full_name");
    setUsers(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = search
    ? users.filter(
        (u) =>
          u.full_name.toLowerCase().includes(search.toLowerCase()) ||
          (u.sector || "").toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const activeManagers = users.filter((u) => u.is_manager && u.active);

  function managerName(id: string | null) {
    if (!id) return "—";
    return users.find((u) => u.id === id)?.full_name ?? "—";
  }

  function openCreateDialog() {
    setEditUser(null);
    setForm({ ...EMPTY_FORM });
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
      is_manager: user.is_manager || false,
      manager_id: user.manager_id || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      ...form,
      is_manager: form.is_manager,
      manager_id: form.manager_id || null,
    };

    if (editUser) {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editUser.id, ...payload }),
      });
    } else {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      {/* Cabeçalho */}
      <div className="brand-gradient rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Usuários Colaboradores</h2>
            <p className="text-blue-100 text-sm">
              {users.filter((u) => u.active).length} ativos ·{" "}
              {activeManagers.length} gestores
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30 border"
            variant="secondary"
          >
            <Plus size={16} className="mr-1.5" /> Novo Usuário
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Buscar por nome ou setor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
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
                <TableHead>Gestor direto</TableHead>
                <TableHead>Ramal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.full_name}
                      {user.is_manager && (
                        <Badge variant="warning" className="text-[10px] gap-1 py-0.5">
                          <ShieldCheck size={10} /> Gestor
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs font-medium border-0 ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.sector || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {managerName(user.manager_id)}
                  </TableCell>
                  <TableCell className="text-sm">{user.phone_ext || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "success" : "secondary"} className="text-xs">
                      {user.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleActive(user)}
                        className={
                          user.active
                            ? "text-red-500 hover:text-red-700"
                            : "text-green-500 hover:text-green-700"
                        }
                      >
                        {user.active ? (
                          <UserX size={14} />
                        ) : (
                          <UserCheck size={14} />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Criação: e-mail + senha */}
            {!editUser && (
              <div className="grid grid-cols-2 gap-3">
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
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Senha para primeiro acesso"
                  />
                </div>
              </div>
            )}

            {/* Nome completo */}
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                placeholder="Nome completo"
              />
            </div>

            {/* Perfil + Setor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Perfil *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
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
                  onChange={(e) =>
                    setForm({ ...form, sector: e.target.value })
                  }
                  placeholder="Ex: UTI, Recepção"
                />
              </div>
            </div>

            {/* Unidade + Ramal */}
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
                  onChange={(e) =>
                    setForm({ ...form, phone_ext: e.target.value })
                  }
                  placeholder="Ex: 1234"
                />
              </div>
            </div>

            {/* Gestor direto */}
            <div className="space-y-2">
              <Label>Gestor direto</Label>
              <Select
                value={form.manager_id || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, manager_id: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem gestor definido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem gestor</SelectItem>
                  {activeManagers
                    .filter((m) => m.id !== editUser?.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                        {m.sector ? ` · ${m.sector}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Apenas usuários marcados como gestor aparecem aqui.
              </p>
            </div>

            {/* É gestor? */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Checkbox
                id="is_manager"
                checked={form.is_manager}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_manager: checked === true })
                }
                className="border-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <Label
                htmlFor="is_manager"
                className="flex items-center gap-1.5 text-sm font-medium text-amber-800 cursor-pointer"
              >
                <ShieldCheck size={15} />
                Este usuário é gestor (pode aprovar ponto de subordinados)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
