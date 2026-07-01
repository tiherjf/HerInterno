"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Heart, MessageSquare, Loader2, Trash2, Send } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface Props {
  newsId: string;
  currentUserId: string;
  isAdminOrTi: boolean;
}

export function NewsInteractions({ newsId, currentUserId, isAdminOrTi }: Props) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Carrega contagem inicial de likes
  useEffect(() => {
    fetch(`/api/noticias/${newsId}/reagir`)
      .then(r => r.json())
      .then(d => { setLikeCount(d.count ?? 0); setLiked(d.liked ?? false); })
      .catch(() => {});
  }, [newsId]);

  async function toggleLike() {
    setLiking(true);
    try {
      const res = await fetch(`/api/noticias/${newsId}/reagir`, { method: "POST" });
      const d = await res.json();
      setLiked(d.liked);
      setLikeCount(d.count);
    } finally {
      setLiking(false);
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/noticias/${newsId}/comentarios`);
      const d = await res.json();
      setComments(d.comments ?? []);
    } finally {
      setLoadingComments(false);
    }
  }

  function toggleComments() {
    if (!showComments) loadComments();
    setShowComments(v => !v);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/noticias/${newsId}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const d = await res.json();
      if (res.ok && d.comment) {
        setComments(prev => [...prev, d.comment]);
        setCommentText("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    await fetch(`/api/noticias/${newsId}/comentarios`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  return (
    <div className="space-y-4">
      <Separator />

      {/* Barra de reações */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost" size="sm"
          onClick={toggleLike}
          disabled={liking}
          className={`gap-1.5 ${liked ? "text-red-500 hover:text-red-600" : "text-muted-foreground"}`}
        >
          {liking
            ? <Loader2 size={15} className="animate-spin" />
            : <Heart size={15} className={liked ? "fill-red-500" : ""} />}
          <span className="text-sm font-medium">{likeCount > 0 ? likeCount : ""}</span>
          <span className="text-sm">{liked ? "Curtido" : "Curtir"}</span>
        </Button>

        <Button variant="ghost" size="sm" onClick={toggleComments}
          className="gap-1.5 text-muted-foreground">
          <MessageSquare size={15} />
          <span className="text-sm">
            {showComments ? "Ocultar" : "Comentários"}
            {comments.length > 0 && ` (${comments.length})`}
          </span>
        </Button>
      </div>

      {/* Comentários */}
      {showComments && (
        <div className="space-y-4">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              Nenhum comentário ainda. Seja o primeiro!
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {c.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-700">{c.author_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                        {(c.author_id === currentUserId || isAdminOrTi) && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            title="Excluir comentário"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form de comentário */}
          <form onSubmit={submitComment} className="flex gap-2 items-end">
            <Textarea
              ref={commentRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Escreva um comentário..."
              rows={2}
              className="resize-none flex-1"
              onKeyDown={e => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitComment(e as any);
              }}
            />
            <Button type="submit" size="icon" disabled={submitting || !commentText.trim()}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">Ctrl+Enter para enviar</p>
        </div>
      )}
    </div>
  );
}
