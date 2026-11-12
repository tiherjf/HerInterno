"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  src: string;
  alt: string;
  className?: string;
}

/** Imagem ampliada em tela cheia. Fecha no clique fora, no X ou com Esc. */
export function LightboxOverlay({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Eventos de portal sobem pela árvore do React: não deixar o clique chegar a um <Link> pai
  const close = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  // Portal no body: um ancestral com transform (ex.: hover que sobe o cartão) quebraria o "fixed"
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-1.5 hover:bg-black/60 transition-colors"
        onClick={close}
        aria-label="Fechar"
      >
        <X size={22} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
      />
    </div>,
    document.body
  );
}

export function ImageLightbox({ src, alt, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`cursor-zoom-in ${className ?? ""}`}
        onClick={() => setOpen(true)}
      />
      {open && <LightboxOverlay src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
