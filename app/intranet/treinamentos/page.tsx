"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GraduationCap, Plus, Play, Edit2, Trash2, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModuloDialog from "@/components/treinamentos/ModuloDialog";
import { youTubeThumbnail } from "@/lib/youtube";

interface Module {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  order_index: number;
  video_count: number;
  watched_count: number;
}

interface Profile {
  role: string;
}

function canManage(role: string) {
  return ["admin", "ti", "rh"].includes(role);
}

export default function TreinamentosPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; initial?: Partial<Module> }>({ open: false });

  const load = useCallback(async () => {
    const [mRes, pRes] = await Promise.all([
      fetch("/api/treinamentos/modulos"),
      fetch("/api/perfil"),
    ]);
    const [mData, pData] = await Promise.all([mRes.json(), pRes.json()]);
    setModules(mData.modules ?? []);
    setProfile(pData.profile);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Desativar o módulo "${name}"?`)) return;
    await fetch(`/api/treinamentos/modulos/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  const isAdmin = profile && canManage(profile.role);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Treinamentos</h2>
          <p className="text-muted-foreground text-sm mt-1">Biblioteca de vídeos por módulo</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Plus size={15} className="mr-1.5" /> Novo Módulo
          </Button>
        )}
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum módulo disponível.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(m => {
            const pct = m.video_count > 0 ? Math.round((m.watched_count / m.video_count) * 100) : 0;
            const done = m.watched_count === m.video_count && m.video_count > 0;

            return (
              <div key={m.id} className="group relative rounded-xl border overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                {/* Cover / placeholder */}
                <Link href={`/intranet/treinamentos/${m.id}`} className="block">
                  <div className="aspect-video bg-linear-to-br from-primary/20 to-primary/5 relative overflow-hidden">
                    {m.cover_url ? (
                      <img src={m.cover_url} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <BookOpen size={48} className="text-primary/30" />
                      </div>
                    )}
                    {done && (
                      <div className="absolute inset-0 bg-green-900/40 flex items-center justify-center">
                        <span className="text-white font-bold text-sm bg-green-600 px-3 py-1 rounded-full">
                          Concluído ✓
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Admin actions */}
                {isAdmin && (
                  <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                    <button
                      onClick={() => setDialog({ open: true, initial: m })}
                      className="bg-white rounded-md p-1.5 shadow text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id, m.name)}
                      className="bg-white rounded-md p-1.5 shadow text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <Link href={`/intranet/treinamentos/${m.id}`}>
                    <h3 className="font-semibold text-base hover:underline leading-snug">{m.name}</h3>
                  </Link>
                  {m.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>
                  )}

                  <div className="mt-auto space-y-2 pt-2">
                    {/* Barra de progresso */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Play size={11} /> {m.video_count} vídeo{m.video_count !== 1 ? "s" : ""}
                      </span>
                      <span>{m.watched_count}/{m.video_count} assistidos</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${done ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModuloDialog
        open={dialog.open}
        initial={dialog.initial}
        onClose={() => setDialog({ open: false })}
        onSaved={load}
      />
    </div>
  );
}
