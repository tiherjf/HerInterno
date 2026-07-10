"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, CheckCircle2, Clock } from "lucide-react";

interface Reader {
  id: string;
  full_name: string;
  sector: string;
  read_at?: string;
}

interface Report {
  total: number;
  read_count: number;
  readers: Reader[];
  pending: Reader[];
}

export function LeitoresDialog({ newsId }: { newsId: string }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"leram" | "pendentes">("leram");

  async function openDialog() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/noticias/${newsId}/leitores`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar relatório");
      setReport(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }

  const pct = report && report.total > 0
    ? Math.round((report.read_count / report.total) * 100)
    : 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <Users size={14} /> Relatório de leitura
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Relatório de Leitura</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 py-4">{error}</p>
          ) : report ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {report.read_count} de {report.total} colaboradores leram
                  </span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={tab === "leram" ? "default" : "outline"}
                  onClick={() => setTab("leram")}
                  className="rounded-full"
                >
                  <CheckCircle2 size={13} /> Leram ({report.read_count})
                </Button>
                <Button
                  size="sm"
                  variant={tab === "pendentes" ? "default" : "outline"}
                  onClick={() => setTab("pendentes")}
                  className="rounded-full"
                >
                  <Clock size={13} /> Pendentes ({report.pending.length})
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1">
                {(tab === "leram" ? report.readers : report.pending).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg border text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{p.sector || "—"}</p>
                    </div>
                    {tab === "leram" && p.read_at ? (
                      <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                        {new Date(p.read_at).toLocaleDateString("pt-BR")}
                      </Badge>
                    ) : null}
                  </div>
                ))}
                {(tab === "leram" ? report.readers : report.pending).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {tab === "leram" ? "Ninguém leu ainda." : "Todos já leram. 🎉"}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
