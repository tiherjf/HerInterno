"use client";

import { useState, useEffect } from "react";
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
import { Plus, Search, Loader2, Upload, Video } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Exam {
  id: string;
  exam_type: string;
  exam_date: string;
  description: string;
  video_filename: string;
  patient_name?: string;
}

export default function ExamesAdminPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    patient_cpf: "",
    exam_type: "",
    exam_date: "",
    description: "",
  });
  const [uploadProgress, setUploadProgress] = useState(0);

  async function fetchExams() {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/admin/exams${params}`);
    const data = await res.json();
    setExams(data.exams || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => fetchExams(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleSave() {
    setSaving(true);
    const formData = new FormData();
    formData.append("patient_cpf", form.patient_cpf.replace(/\D/g, ""));
    formData.append("exam_type", form.exam_type);
    formData.append("exam_date", form.exam_date);
    formData.append("description", form.description);
    if (videoFile) formData.append("video", videoFile);

    const res = await fetch("/api/admin/exams", {
      method: "POST",
      body: formData,
    });

    setSaving(false);
    if (res.ok) {
      setDialogOpen(false);
      setVideoFile(null);
      fetchExams();
    } else {
      const data = await res.json();
      alert(data.error || "Erro ao cadastrar exame");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exames de Vídeo</h2>
          <p className="text-muted-foreground">{exams.length} exame(s) no sistema</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} /> Novo Exame
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente ou tipo..."
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
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo de Exame</TableHead>
                <TableHead>Data do Exame</TableHead>
                <TableHead>Vídeo</TableHead>
                <TableHead>Cadastrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.patient_name || "—"}</TableCell>
                  <TableCell>{exam.exam_type || "—"}</TableCell>
                  <TableCell>{exam.exam_date ? formatDate(exam.exam_date) : "—"}</TableCell>
                  <TableCell>
                    {exam.video_filename ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <Video size={14} /> Disponível
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sem vídeo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate((exam as any).created_at)}
                  </TableCell>
                </TableRow>
              ))}
              {exams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum exame cadastrado.
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
            <DialogTitle>Cadastrar Exame</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>CPF do Paciente *</Label>
              <Input
                value={form.patient_cpf}
                onChange={(e) => setForm({ ...form, patient_cpf: e.target.value })}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Exame</Label>
                <Input
                  value={form.exam_type}
                  onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
                  placeholder="Ex: Endoscopia"
                />
              </div>
              <div className="space-y-2">
                <Label>Data do Exame</Label>
                <Input
                  type="date"
                  value={form.exam_date}
                  onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Observações sobre o exame"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Arquivo de Vídeo</Label>
              <Input
                type="file"
                accept="video/mp4,video/avi,video/mov"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              />
              {videoFile && (
                <p className="text-sm text-muted-foreground">
                  Selecionado: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              ) : (
                <><Upload size={16} /> Cadastrar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
