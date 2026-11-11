"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEARCH_GROUPS, SEARCH_GROUP_LABELS, type SearchHit } from "@/lib/busca/query";

const DEBOUNCE_MS = 250;

/**
 * Busca geral do cabeçalho: digita → consulta /api/busca → lista agrupada.
 * Teclado: Ctrl/Cmd+K foca, ↑/↓ navega, Enter abre, Esc fecha.
 */
export function GlobalSearch({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searched, setSearched] = useState("");

  // Ctrl/Cmd+K foca a busca de qualquer tela
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clique fora fecha
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounce + cancela a requisição anterior quando o termo muda
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setSearched("");
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/busca?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits?: SearchHit[] }) => {
          setHits(d.hits ?? []);
          setSearched(term);
          setActive(0);
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Ordem plana na mesma sequência em que os grupos aparecem (para ↑/↓)
  const ordered = useMemo(
    () => SEARCH_GROUPS.flatMap((g) => hits.filter((h) => h.group === g)),
    [hits]
  );

  const go = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      router.push(hit.href);
    },
    [router]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(ordered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && ordered[active]) {
      e.preventDefault();
      go(ordered[active]);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2 h-10 rounded-xl border border-border bg-slate-50 px-3 text-sm transition-colors focus-within:border-primary/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/15">
        {loading ? (
          <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" />
        ) : (
          <Search size={16} className="shrink-0 text-slate-400" />
        )}
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar ramal, notícia, médico, documento…"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
          aria-label="Buscar na intranet"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="busca-geral-resultados"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="hidden md:inline-flex items-center rounded-md border border-border bg-white px-1.5 text-[10px] font-medium text-slate-400">
            Ctrl K
          </kbd>
        )}
      </div>

      {showPanel && (
        <div
          id="busca-geral-resultados"
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-xl"
        >
          {ordered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {loading || searched !== query.trim()
                ? "Buscando…"
                : <>Nenhum resultado para “{query.trim()}”</>}
            </p>
          ) : (
            SEARCH_GROUPS.map((g) => {
              const items = ordered.filter((h) => h.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g} className="py-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {SEARCH_GROUP_LABELS[g]}
                  </p>
                  {items.map((hit) => {
                    const idx = ordered.indexOf(hit);
                    return (
                      <button
                        key={`${hit.group}-${hit.id}`}
                        type="button"
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(hit)}
                        className={cn(
                          "flex w-full flex-col items-start rounded-lg px-3 py-2 text-left",
                          idx === active ? "bg-accent text-primary" : "text-slate-700"
                        )}
                      >
                        <span className="text-sm font-medium leading-tight">{hit.title}</span>
                        {hit.subtitle && (
                          <span className="text-xs text-slate-500">{hit.subtitle}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
