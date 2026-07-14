"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, Download, Upload, Loader2, FolderOpen, Trash2, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";

interface Document {
  id: string;
  title: string;
  category: string;
  sector: string;
  tags: string[];
  file_url: string;
  file_type: string;
  created_at: string;
  created_by: string;
}

const CATEGORIES = ["POP", "Protocolo", "Formulário", "Manual", "Outros"];

const fileIcon: Record<string, string> = {
  pdf: "📄",
  doc: "📝",
  docx: "📝",
  xls: "📊",
  xlsx: "📊",
  ppt: "📊",
  pptx: "📊",
  jpg: "🖼",
  jpeg: "🖼",
  png: "🖼",
};

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { canEdit: canUpload } = useMenuPermission("documentos");

  // Dialog de upload
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", category: "POP", sector: "", tags: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/documentos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar documentos");
      setDocs(json.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar documentos");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((doc) => {
      if (category !== "Todos" && doc.category !== category) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        (doc.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [docs, search, category]);

  async function handleUpload() {
    if (!uploadFile) { setUploadError("Selecione um arquivo."); return; }
    if (!uploadForm.title.trim()) { setUploadError("Informe o título."); return; }

    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadForm.title);
      fd.append("category", uploadForm.category);
      fd.append("sector", uploadForm.sector);
      fd.append("tags", uploadForm.tags);
      const res = await fetch("/api/documentos", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error || "Erro ao enviar."); return; }
      setUploadOpen(false);
      setUploadForm({ title: "", category: "POP", sector: "", tags: "" });
      setUploadFile(null);
      fetchDocs();
    } catch {
      setUploadError("Erro ao enviar o documento. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: Document) {
    if (!window.confirm(`Excluir o documento "${doc.title}"?`)) return;
    const res = await fetch(`/api/documentos/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Erro ao excluir documento.");
      return;
    }
    fetchDocs();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Base de Documentos</h2>
          <p className="text-muted-foreground">POPs, protocolos, formulários e manuais</p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)} className="w-full sm:w-auto">
            <Upload size={16} /> Enviar Documento
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["Todos", ...CATEGORIES].map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={category === cat ? "default" : "outline"}
              onClick={() => setCategory(cat)}
              className="rounded-full"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">Nenhum documento encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="hidden md:table-cell">Setor</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => {
                const ext = doc.file_type || doc.file_url?.split(".").pop() || "";
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{fileIcon[ext] || "📁"}</span>
                        <span className="font-medium">{doc.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {doc.sector || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(doc.tags || []).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(doc.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/documentos/${doc.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="ghost">
                            <Download size={14} /> Baixar
                          </Button>
                        </a>
                        {canUpload && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(doc)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* Dialog de upload */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo *</Label>
              <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <FileText size={20} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  {uploadFile ? (
                    <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar (PDF, Word, Excel, PowerPoint ou imagem — máx. 20MB)
                    </p>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                placeholder="Ex.: POP de Higienização das Mãos"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={uploadForm.category}
                  onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Input
                  value={uploadForm.sector}
                  onChange={(e) => setUploadForm({ ...uploadForm, sector: e.target.value })}
                  placeholder="Ex.: Enfermagem"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags <span className="text-muted-foreground text-xs">(separadas por vírgula)</span></Label>
              <Input
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                placeholder="Ex.: higiene, ccih, segurança"
              />
            </div>
            {uploadError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle size={16} /> {uploadError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
