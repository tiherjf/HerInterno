"use client";

import { useId, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import { X } from "lucide-react";
import { adicionarTags } from "@/lib/ui/tags";

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  sugestoes?: string[];
  placeholder?: string;
  id?: string;
}

/**
 * Campo de etiquetas: Enter ou vírgula adiciona, × remove, Backspace com o
 * campo vazio remove a última. Colar "A, B, C" adiciona as três.
 */
export function TagInput({ value, onChange, sugestoes = [], placeholder, id }: TagInputProps) {
  const [texto, setTexto] = useState("");
  const listaId = useId();

  const confirmar = (t: string) => {
    const novo = adicionarTags(value, t);
    if (novo.length !== value.length) onChange(novo);
    setTexto("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      confirmar(texto);
    } else if (e.key === "Backspace" && texto === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const colado = e.clipboardData.getData("text");
    if (colado.includes(",")) {
      e.preventDefault();
      confirmar(texto + colado);
    }
  };

  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring/40">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full text-primary/60 hover:text-primary"
            aria-label={`Remover ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={sugestoes.length ? listaId : undefined}
        value={texto}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) confirmar(v);
          else setTexto(v);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => texto.trim() && confirmar(texto)}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground"
      />
      {sugestoes.length > 0 && (
        <datalist id={listaId}>
          {sugestoes.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}
