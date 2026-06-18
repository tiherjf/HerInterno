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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Bold, Italic, List, ListOrdered, Save, Eye } from "lucide-react";

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
  };
}

export function NewsForm({ authorId, initialData }: NewsFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(initialData?.title || "");
  const [summary, setSummary] = useState(initialData?.summary || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(initialData?.cover_url || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Escreva o conteúdo da notícia aqui..." }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialData?.body || "",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(publishNow: boolean) {
    if (!title || !category) {
      setError("Título e categoria são obrigatórios.");
      return;
    }
    setLoading(true);
    setError("");

    let coverUrl = initialData?.cover_url || "";

    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `news/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, coverFile, { upsert: true });

      if (uploadError) {
        setError("Erro ao fazer upload da imagem.");
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      coverUrl = urlData.publicUrl;
    }

    const newsStatus = publishNow ? "published" : "draft";
    const payload = {
      title,
      summary,
      body: editor?.getHTML() || "",
      category,
      cover_url: coverUrl,
      status: newsStatus,
      author_id: authorId,
      published_at: publishNow ? new Date().toISOString() : null,
    };

    if (initialData?.id) {
      const { error } = await supabase.from("news").update(payload).eq("id", initialData.id);
      if (error) {
        setError("Erro ao salvar notícia.");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.from("news").insert(payload);
      if (error) {
        setError("Erro ao criar notícia.");
        setLoading(false);
        return;
      }
    }

    router.push("/intranet/noticias");
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
      {error && (
        <div className="text-destructive text-sm bg-red-50 p-3 rounded-md">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da notícia"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover">Imagem de Capa</Label>
          <Input id="cover" type="file" accept="image/*" onChange={handleCoverChange} />
          {coverPreview && (
            <img
              src={coverPreview}
              alt="Preview"
              className="mt-2 w-32 h-20 object-cover rounded"
            />
          )}
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="summary">Resumo</Label>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Breve resumo para exibição nas listagens"
            rows={3}
          />
        </div>
      </div>

      {/* Editor Tiptap */}
      <div className="space-y-2">
        <Label>Conteúdo *</Label>
        <div className="border border-input rounded-md overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b bg-gray-50">
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded hover:bg-gray-200 ${editor?.isActive("bold") ? "bg-gray-200" : ""}`}
              title="Negrito"
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-gray-200 ${editor?.isActive("italic") ? "bg-gray-200" : ""}`}
              title="Itálico"
            >
              <Italic size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded hover:bg-gray-200 text-xs font-bold ${editor?.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""}`}
              title="Título H2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded hover:bg-gray-200 ${editor?.isActive("bulletList") ? "bg-gray-200" : ""}`}
              title="Lista"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded hover:bg-gray-200 ${editor?.isActive("orderedList") ? "bg-gray-200" : ""}`}
              title="Lista numerada"
            >
              <ListOrdered size={16} />
            </button>
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Rascunho
        </Button>
        <Button onClick={() => handleSubmit(true)} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
          Publicar
        </Button>
      </div>
    </div>
  );
}
