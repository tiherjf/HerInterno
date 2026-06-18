"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, Download, Upload, Loader2, FolderOpen } from "lucide-react";
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

export default function DocumentosPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const { canEdit: canUpload } = useMenuPermission("documentos");

  const fetchDocs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,tags.cs.{${search}}`);
    }
    if (category !== "Todos") {
      query = query.eq("category", category);
    }

    const { data } = await query;
    setDocs(data || []);
    setLoading(false);
  }, [supabase, search, category]);

  useEffect(() => {
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => fetchDocs(), 300);
    return () => clearTimeout(timer);
  }, [fetchDocs]);

  const fileIcon: Record<string, string> = {
    pdf: "📄",
    docx: "📝",
    xlsx: "📊",
    pptx: "📊",
    jpg: "🖼",
    png: "🖼",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Base de Documentos</h2>
          <p className="text-muted-foreground">POPs, protocolos, formulários e manuais</p>
        </div>
        {canUpload && (
          <Button>
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
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">Nenhum documento encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => {
                const ext = doc.file_url?.split(".").pop() || "";
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{fileIcon[ext] || "📁"}</span>
                        <span className="font-medium">{doc.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {doc.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.sector || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(doc.tags || []).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Button size="sm" variant="ghost">
                          <Download size={14} /> Baixar
                        </Button>
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
