"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Plus, Pencil, Trash2, Loader2, Brain } from "lucide-react";

interface Knowledge {
  id: string;
  category: string;
  question: string;
  answer: string;
  active: boolean;
}

const CATEGORIES = ["rh", "ti", "ramais", "geral", "treinamentos", "eventos"];

export default function ChatbotConfigPage() {
  const supabase = createClient();
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Knowledge | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "", question: "", answer: "" });
  const [filterCategory, setFilterCategory] = useState("all");

  async function fetchKnowledge() {
    setLoading(true);
    let query = supabase
      .from("chatbot_knowledge")
      .select("*")
      .order("category")
      .order("question");

    if (filterCategory !== "all") {
      query = query.eq("category", filterCategory);
    }

    const { data } = await query;
    setKnowledge(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchKnowledge();
  }, [filterCategory]);

  function openCreate() {
    setEditItem(null);
    setForm({ category: "", question: "", answer: "" });
    setDialogOpen(true);
  }

  function openEdit(item: Knowledge) {
    setEditItem(item);
    setForm({ category: item.category, question: item.question, answer: item.answer });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editItem) {
      await supabase
        .from("chatbot_knowledge")
        .update({ category: form.category, question: form.question, answer: form.answer })
        .eq("id", editItem.id);
    } else {
      await supabase.from("chatbot_knowledge").insert({
        category: form.category,
        question: form.question,
        answer: form.answer,
        active: true,
      });
    }
    setDialogOpen(false);
    fetchKnowledge();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este item?")) return;
    await supabase.from("chatbot_knowledge").delete().eq("id", id);
    fetchKnowledge();
  }

  async function toggleActive(item: Knowledge) {
    await supabase
      .from("chatbot_knowledge")
      .update({ active: !item.active })
      .eq("id", item.id);
    fetchKnowledge();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Brain size={24} /> Base de Conhecimento
          </h2>
          <p className="text-muted-foreground">
            Gerencie o conteúdo injetado no sistema prompt do chatbot
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto shrink-0">
          <Plus size={16} /> Adicionar
        </Button>
      </div>

      {/* Filtro por categoria */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              filterCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {cat === "all" ? "Todos" : cat.toUpperCase()}
          </button>
        ))}
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
                <TableHead className="w-20">Categoria</TableHead>
                <TableHead>Pergunta</TableHead>
                <TableHead className="hidden md:table-cell">Resposta</TableHead>
                <TableHead className="hidden sm:table-cell w-20">Status</TableHead>
                <TableHead className="text-right w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {knowledge.map((item) => (
                <TableRow key={item.id} className={!item.active ? "opacity-50" : ""}>
                  <TableCell>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase font-medium">
                      {item.category}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm font-medium line-clamp-2">{item.question}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-xs">
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.answer}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <button onClick={() => toggleActive(item)}>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                          item.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.active ? "Ativo" : "Inativo"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {knowledge.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum item na base de conhecimento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Item" : "Adicionar Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pergunta / Gatilho *</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Ex: Quantos dias de férias tenho direito?"
              />
            </div>
            <div className="space-y-2">
              <Label>Resposta *</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="Resposta detalhada que será injetada no contexto do assistente..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.category || !form.question || !form.answer}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
