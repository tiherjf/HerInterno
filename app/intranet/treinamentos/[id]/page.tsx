"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Play, CheckCircle, Circle, Edit2, Trash2,
  Loader2, Clock, GraduationCap, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoDialog from "@/components/treinamentos/VideoDialog";
import ModuloDialog from "@/components/treinamentos/ModuloDialog";
import { youTubeThumbnail } from "@/lib/youtube";

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  duration_minutes: number | null;
  order_index: number;
  watched: boolean;
}

interface Module {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  order_index: number;
}

interface Profile { role: string; }

function canManage(role: string) { return ["admin", "ti", "rh"].includes(role); }

export default function ModuloPage() {
  const { id } = useParams<{ id: string }>();
  const [module, setModule] = useState<Module | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoDialog, setVideoDialog] = useState<{ open: boolean; initial?: Video }>({ open: false });
  const [editModDialog, setEditModDialog] = useState(false);

  const load = useCallback(async () => {
    const [mRes, pRes] = await Promise.all([
      fetch(`/api/treinamentos/modulos/${id}`),
      fetch("/api/perfil"),
    ]);
    const [mData, pData] = await Promise.all([mRes.json(), pRes.json()]);
    if (mData.module) { setModule(mData.module); setVideos(mData.videos ?? []); }
    setProfile(pData);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function deleteVideo(vid: Video) {
    if (!confirm(`Remover "${vid.title}"?`)) return;
    await fetch(`/api/treinamentos/videos/${vid.id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Módulo não encontrado.</p>
        <Link href="/intranet/treinamentos"><Button variant="outline" className="mt-4">Voltar</Button></Link>
      </div>
    );
  }

  const isAdmin = profile && canManage(profile.role);
  const watchedCount = videos.filter(v => v.watched).length;
  const pct = videos.length > 0 ? Math.round((watchedCount / videos.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/intranet/treinamentos">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft size={15} /> Treinamentos
          </Button>
        </Link>
      </div>

      {/* Header do módulo */}
      <div className="rounded-xl border overflow-hidden">
        {module.cover_url && (
          <div className="aspect-video">
            <img src={module.cover_url} alt={module.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{module.name}</h1>
              {module.description && <p className="text-muted-foreground text-sm mt-1">{module.description}</p>}
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setEditModDialog(true)}>
                <Edit2 size={13} className="mr-1.5" /> Editar
              </Button>
            )}
          </div>

          {/* Progresso */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{watchedCount}/{videos.length} vídeos assistidos</span>
              <span className={`font-medium ${pct === 100 ? "text-green-600" : "text-primary"}`}>{pct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de vídeos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            Vídeos <span className="text-muted-foreground font-normal text-base">({videos.length})</span>
          </h2>
          {isAdmin && (
            <Button size="sm" onClick={() => setVideoDialog({ open: true })}>
              <Plus size={14} className="mr-1.5" /> Adicionar vídeo
            </Button>
          )}
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 border rounded-xl text-muted-foreground">
            <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum vídeo neste módulo ainda.</p>
          </div>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden">
            {videos.map((v, i) => (
              <div key={v.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors group">
                {/* Thumbnail */}
                <Link href={`/intranet/treinamentos/${id}/${v.id}`} className="shrink-0">
                  <div className="w-24 aspect-video rounded-md overflow-hidden bg-muted relative">
                    <img
                      src={youTubeThumbnail(v.youtube_id)}
                      alt={v.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Play size={20} className="text-white fill-white" />
                    </div>
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                    <Link href={`/intranet/treinamentos/${id}/${v.id}`} className="hover:underline font-medium truncate">
                      {v.title}
                    </Link>
                  </div>
                  {v.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5 pl-7">{v.description}</p>
                  )}
                  {v.duration_minutes && (
                    <p className="text-xs text-muted-foreground mt-0.5 pl-7 flex items-center gap-1">
                      <Clock size={11} /> {v.duration_minutes} min
                    </p>
                  )}
                </div>

                {/* Status + ações */}
                <div className="shrink-0 flex items-center gap-2">
                  {v.watched ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <Circle size={18} className="text-muted-foreground/40" />
                  )}
                  {isAdmin && (
                    <div className="hidden group-hover:flex gap-1">
                      <button onClick={() => setVideoDialog({ open: true, initial: v })} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteVideo(v)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <VideoDialog
        open={videoDialog.open}
        initial={videoDialog.initial}
        moduleId={id}
        onClose={() => setVideoDialog({ open: false })}
        onSaved={load}
      />
      <ModuloDialog
        open={editModDialog}
        initial={module}
        onClose={() => setEditModDialog(false)}
        onSaved={load}
      />
    </div>
  );
}
