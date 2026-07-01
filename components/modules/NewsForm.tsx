"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2, Bold, Italic, List, ListOrdered, Save, Eye, CalendarClock, Heading2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CATEGORIES = ["Institucional", "RH", "Qualidade", "TI", "Eventos"];

interface NewsFormProps {
  authorId: string;
  initialData?: {
    id: string;
    title: string;
    summary: string;
    body: string;
    category: string;
    status: string;
    cover_url: string;
    scheduled_for?: string | null;
  };
}

export function NewsForm({ authorId, initialData }: NewsFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!initialData?.id;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [summary, setSummary] = useState(initialData?.summary ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(initialData?.cover_url ?? "");
  const [scheduledFor, setScheduledFor] = useState(
    initialData?.scheduled_for
      ? new Date(initialData.scheduled_for).toISOString().slice(0, 16)
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Escreva o conteúdo da notícia aqui..." }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialData?.body ?? "",
    editorProps: { attributes: { class: "tiptap-editor" } },
  });

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  }

  async function uploadCover(): Promise<string | null> {
    if (!coverFile) return initialData?.cover_url ?? null;
    const ext = coverFile.name.split(".").pop();
    const path = `news/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("media").upload(path, coverFile, { upsert: true });
    if (uploadError) throw new Error("Erro ao fazer upload da imagem.");
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function handleSubmit(mode: "draft" | "publish" | "schedule") {
    if (!title.trim() || !category) {
      setError("Título e categoria são obrigatórios.");
      return;
    }
    if (mode === "schedule" && !scheduledFor) {
      setError("Defina a data/hora para o agendamento.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const coverUrl = await uploadCover();
      const body = editor?.getHTML() ?? "";

      if (isEditing) {
        // PUT via API (respeita permissões de autor vs admin)
        const res = await fetch(`/api/noticias/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            summary,
            body,
            category,
            cover_url: coverUrl,
            status: mode === "draft" ? "draft" : "published",
            scheduled_for: mode === "schedule" ? scheduledFor : null,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erro ao salvar."); return; }
      } else {
        // Criação direta via Supabase (INSERT)
        const publishNow = mode === "publish";
        const publishAt = mode === "schedule"
          ? new Date(scheduledFor).toISOString()
          : publishNow ? new Date().toISOString() : null;

        const { error: dbError } = await supabase.from("news").insert({
          title: title.trim(),
          summary,
          body,
          category,
          cover_url: coverUrl,
          status: mode === "draft" ? "draft" : "published",
          author_id: authorId,
          published_at: publishAt,
          scheduled_for: mode === "schedule" ? new Date(scheduledFor).toISOString() : null,
        });
        if (dbError) throw dbError;
      }

      router.push("/intranet/noticias");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar notícia.");
    } finally {
      setLoading(false);
    }
  }

  const minSchedule = new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16);

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input id="title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título da notícia" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover">Imagem de Capa</Label>
          <Input id="cover" type="file" accept="image/*" onChange={handleCoverChange} />
          {coverPreview && (
            <img src={coverPreview} alt="Preview" className="mt-2 w-32 h-20 object-cover rounded" />
          )}
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="summary">Resumo</Label>
          <Textarea id="summary" value={summary} onChange={e => setSummary(e.target.value)}
            placeholder="Breve resumo para exibição nas listagens" rows={2} />
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-2">
        <Label>Conteúdo *</Label>
        <div className="border border-input rounded-md overflow-hidden">
          <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
            <Button type="button" size="icon" variant={editor?.isActive("bold") ? "secondary" : "ghost"}
              className="w-7 h-7" title="Negrito"
              onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold size={14} />
            </Button>
            <Button type="button" size="icon" variant={editor?.isActive("italic") ? "secondary" : "ghost"}
              className="w-7 h-7" title="Itálico"
              onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic size={14} />
            </Button>
            <Button type="button" size="icon"
              variant={editor?.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
              className="w-7 h-7" title="Título H2"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 size={14} />
            </Button>
            <Button type="button" size="icon"
              variant={editor?.isActive("heading", { level: 3 }) ? "secondary" : "ghost"}
              className="w-7 h-7 text-xs font-bold" title="Título H3"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
              H3
            </Button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <Button type="button" size="icon" variant={editor?.isActive("bulletList") ? "secondary" : "ghost"}
              className="w-7 h-7" title="Lista"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List size={14} />
            </Button>
            <Button type="button" size="icon" variant={editor?.isActive("orderedList") ? "secondary" : "ghost"}
              className="w-7 h-7" title="Lista numerada"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={14} />
            </Button>
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Agendamento */}
      <div className="space-y-2">
        <Label htmlFor="schedule" className="flex items-center gap-1.5">
          <CalendarClock size={14} /> Agendar publicação <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
        </Label>
        <Input id="schedule" type="datetime-local" value={scheduledFor}
          onChange={e => setScheduledFor(e.target.value)} min={minSchedule} className="w-auto" />
        {scheduledFor && (
          <p className="text-xs text-muted-foreground">
            A notícia será publicada em{" "}
            <strong>{new Date(scheduledFor).toLocaleString("pt-BR")}</strong> e ficará visível a partir desse horário.
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3 justify-end pt-2 border-t">
        <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar Rascunho
        </Button>
        {scheduledFor ? (
          <Button onClick={() => handleSubmit("schedule")} disabled={loading}
            className="bg-amber-500 hover:bg-amber-600">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            Agendar
          </Button>
        ) : (
          <Button onClick={() => handleSubmit("publish")} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            {isEditing ? "Salvar e Publicar" : "Publicar Agora"}
          </Button>
        )}
      </div>
    </div>
  );
}
