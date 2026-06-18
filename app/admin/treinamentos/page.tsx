"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Training {
  id: string;
  title: string;
  workload_hours: number;
  passing_score: number;
  active: boolean;
}

interface Completion {
  id: string;
  training_id: string;
  score: number;
  completed_at: string;
  profiles: { full_name: string; sector: string };
  trainings: { title: string };
}

export default function TreinamentosAdminPage() {
  const supabase = createClient();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Training | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    video_url: "",
    material_url: "",
    workload_hours: 1,
    passing_score: 70,
  });

  async function fetchData() {
    setLoading(true);
    const [{ data: trs }, { data: comps }] = await Promise.all([
      supabase.from("trainings").select("*").order("created_at", { ascending: false }),
      supabase
        .from("training_completions")
        .select("*, profiles!user_id(full_name, sector), trainings!training_id(title)")
        .order("completed_at", { ascending: false })
        .limit(100),
    ]);
    setTrainings(trs || []);
    setCompletions(comps as Completion[] || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  function openCreate() {
    setEditItem(null);
    setForm({ title: "", description: "", video_url: "", material_url: "", workload_hours: 1, passing_score: 70 });
    setDialogOpen(true);
  }

  function openEdit(t: Training) {
    setEditItem(t);
    setForm({
      title: t.title,
      description: (t as any).description || "",
      video_url: (t as any).video_url || "",
      material_url: (t as any).material_url || "",
      workload_hours: t.workload_hours,
      passing_score: t.passing_score,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editItem) {
      await supabase.from("trainings").update(form).eq("id", editItem.id);
    } else {
      await supabase.from("trainings").insert({ ...form, active: true });
    }
    setDialogOpen(false);
    fetchData();
    setSaving(false);
  }

  async function toggleActive(t: Training) {
    await supabase.from("trainings").update({ active: !t.active }).eq("id", t.id);
    fetchData();
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Treinamentos</h2>
        <Button onClick={openCreate}>
          <Plus size={16} /> Novo Treinamento
        </Button>
      </div>

      <Tabs defaultValue="trainings">
        <TabsList>
          <TabsTrigger value="trainings">Treinamentos</TabsTrigger>
          <TabsTrigger value="reports">
            <Users size={14} className="mr-1" /> Relatório de Conclusões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trainings">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Carga horária</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainings.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>{t.workload_hours}h</TableCell>
                      <TableCell>{t.passing_score}%</TableCell>
                      <TableCell>
                        <button onClick={() => toggleActive(t)}>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                            {t.active ? "Ativo" : "Inativo"}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                          <Pencil size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Treinamento</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Concluído em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.profiles?.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.profiles?.sector}</TableCell>
                    <TableCell>{c.trainings?.title}</TableCell>
                    <TableCell>
                      <span className={`font-medium ${c.score >= 70 ? "text-green-600" : "text-red-600"}`}>
                        {c.score}%
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.completed_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {completions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma conclusão registrada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Treinamento" : "Novo Treinamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>URL do Vídeo</Label>
              <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://... ou link do Storage" />
            </div>
            <div className="space-y-2">
              <Label>URL do Material (PDF)</Label>
              <Input value={form.material_url} onChange={(e) => setForm({ ...form, material_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Carga Horária (h)</Label>
                <Input type="number" min={0.5} step={0.5} value={form.workload_hours} onChange={(e) => setForm({ ...form, workload_hours: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Nota mínima (%)</Label>
                <Input type="number" min={0} max={100} value={form.passing_score} onChange={(e) => setForm({ ...form, passing_score: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
