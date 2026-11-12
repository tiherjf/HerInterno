"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LightboxOverlay } from "@/components/news/ImageLightbox";

interface Props {
  src: string;
  alt: string;
  /** Altura e cantos vêm daqui (ex.: "h-72 md:h-96 rounded-xl"). */
  className?: string;
  /** Mostra "Ampliar" e abre a imagem em tela cheia ao clicar. */
  zoomable?: boolean;
  /** Onde a imagem fica quando sobra espaço nas laterais. */
  position?: "center" | "right";
  /** O que mostrar se a imagem não carregar (padrão: nada). */
  fallback?: React.ReactNode;
}

/**
 * Capa que nunca corta: a imagem aparece inteira (contain) sobre uma cópia
 * dela mesma, desfocada, preenchendo o espaço. Cartaz vertical fica inteiro;
 * foto horizontal preenche praticamente tudo.
 */
export function CoverImage({ src, alt, className, zoomable, position = "center", fallback = null }: Props) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const imgRef = useRef<HTMLImageElement>(null);

  // A imagem vem do servidor: se ela falhar antes da hidratação, o onError do
  // React não dispara. Confere o estado real ao montar.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (failed) return <>{fallback}</>;

  return (
    <div className={cn("relative overflow-hidden bg-slate-900", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-75"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        onClick={
          zoomable
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
              }
            : undefined
        }
        className={cn(
          "relative h-full w-full object-contain",
          position === "right" ? "object-center md:object-right" : "object-center",
          zoomable && "cursor-zoom-in"
        )}
      />
      {zoomable && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-primary shadow-sm hover:bg-white"
        >
          <Maximize2 size={12} /> Ampliar
        </button>
      )}
      {open && <LightboxOverlay src={src} alt={alt} onClose={close} />}
    </div>
  );
}
