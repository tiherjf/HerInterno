"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Circle, ChevronLeft, ChevronRight,
  Loader2, Clock, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { youTubeEmbedUrl, youTubeThumbnail } from "@/lib/youtube";

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
}

export default function VideoPage() {
  const { id: moduleId, videoId } = useParams<{ id: string; videoId: string }>();
  const [module, setModule] = useState<Module | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [watched, setWatched] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [modRes, vidRes] = await Promise.all([
      fetch(`/api/treinamentos/modulos/${moduleId}`),
      fetch(`/api/treinamentos/videos/${videoId}`),
    ]);
    const [modData, vidData] = await Promise.all([modRes.json(), vidRes.json()]);
    setModule(modData.module ?? null);
    setAllVideos(modData.videos ?? []);
    if (vidData.video) {
      setVideo(vidData.video);
      setWatched(vidData.video.watched);
    }
    setLoading(false);
  }, [moduleId, videoId]);

  useEffect(() => { load(); }, [load]);

  async function toggleWatched() {
    if (!video) return;
    setToggling(true);
    const method = watched ? "DELETE" : "POST";
    const res = await fetch(`/api/treinamentos/videos/${videoId}/assistido`, { method });
    if (res.ok) {
      setWatched(!watched);
      // Atualiza lista lateral
      setAllVideos(prev => prev.map(v => v.id === videoId ? { ...v, watched: !watched } : v));
    }
    setToggling(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Vídeo não encontrado.</p>
        <Link href={`/intranet/treinamentos/${moduleId}`}>
          <Button variant="outline" className="mt-4">Voltar ao módulo</Button>
        </Link>
      </div>
    );
  }

  const currentIndex = allVideos.findIndex(v => v.id === videoId);
  const prevVideo = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/intranet/treinamentos" className="hover:text-foreground">Treinamentos</Link>
        <span>/</span>
        <Link href={`/intranet/treinamentos/${moduleId}`} className="hover:text-foreground">
          {module?.name ?? "Módulo"}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-48">{video.title}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Coluna principal — player */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Player */}
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
            <iframe
              src={youTubeEmbedUrl(video.youtube_id)}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* Info + ação */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">{video.title}</h1>
                {video.duration_minutes && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock size={13} /> {video.duration_minutes} min
                  </p>
                )}
              </div>
              <Button
                variant={watched ? "outline" : "default"}
                size="sm"
                onClick={toggleWatched}
                disabled={toggling}
                className={watched ? "border-green-300 text-green-700 hover:bg-green-50" : ""}
              >
                {toggling ? (
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                ) : watched ? (
                  <CheckCircle size={14} className="mr-1.5" />
                ) : (
                  <Circle size={14} className="mr-1.5" />
                )}
                {watched ? "Assistido" : "Marcar como assistido"}
              </Button>
            </div>

            {video.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{video.description}</p>
            )}
          </div>

          {/* Navegação prev/next */}
          <div className="flex gap-3 pt-2 border-t">
            {prevVideo ? (
              <Link href={`/intranet/treinamentos/${moduleId}/${prevVideo.id}`} className="flex-1">
                <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                  <ChevronLeft size={16} className="shrink-0" />
                  <div className="text-left min-w-0">
                    <div className="text-xs text-muted-foreground">Anterior</div>
                    <div className="text-sm font-medium truncate">{prevVideo.title}</div>
                  </div>
                </Button>
              </Link>
            ) : <div className="flex-1" />}

            {nextVideo ? (
              <Link href={`/intranet/treinamentos/${moduleId}/${nextVideo.id}`} className="flex-1">
                <Button variant="outline" className="w-full justify-end gap-2 h-auto py-3">
                  <div className="text-right min-w-0">
                    <div className="text-xs text-muted-foreground">Próximo</div>
                    <div className="text-sm font-medium truncate">{nextVideo.title}</div>
                  </div>
                  <ChevronRight size={16} className="shrink-0" />
                </Button>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        </div>

        {/* Sidebar — lista do módulo */}
        <aside className="lg:w-72 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{module?.name}</h3>
            <span className="text-xs text-muted-foreground">
              {allVideos.filter(v => v.watched).length}/{allVideos.length}
            </span>
          </div>

          {/* Barra de progresso mini */}
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="h-1 rounded-full bg-primary transition-all"
              style={{
                width: allVideos.length > 0
                  ? `${Math.round((allVideos.filter(v => v.watched).length / allVideos.length) * 100)}%`
                  : "0%",
              }}
            />
          </div>

          <div className="border rounded-xl overflow-hidden divide-y">
            {allVideos.map((v, i) => {
              const isCurrent = v.id === videoId;
              return (
                <Link
                  key={v.id}
                  href={`/intranet/treinamentos/${moduleId}/${v.id}`}
                  className={`flex items-center gap-3 p-3 transition-colors text-sm ${
                    isCurrent ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40"
                  }`}
                >
                  {/* Thumb mini */}
                  <div className="w-14 aspect-video rounded overflow-hidden bg-muted shrink-0 relative">
                    <img src={youTubeThumbnail(v.youtube_id)} alt="" className="w-full h-full object-cover" />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <Play size={12} className="text-white fill-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground shrink-0">{i + 1}.</span>
                      <span className={`truncate ${isCurrent ? "font-semibold text-primary" : ""}`}>
                        {v.title}
                      </span>
                    </div>
                    {v.duration_minutes && (
                      <span className="text-xs text-muted-foreground">{v.duration_minutes} min</span>
                    )}
                  </div>

                  <div className="shrink-0">
                    {v.watched ? (
                      <CheckCircle size={15} className="text-green-500" />
                    ) : (
                      <Circle size={15} className="text-muted-foreground/30" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
