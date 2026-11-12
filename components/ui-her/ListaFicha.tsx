"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { selecaoValida } from "@/lib/ui/selecao";

const DESKTOP = "(min-width: 1024px)";

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const atualizar = () => setDesktop(mq.matches);
    atualizar();
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, []);
  return desktop;
}

interface ListaFichaProps<T> {
  itens: T[];
  idDe: (item: T) => string;
  /** Desenha a lista. `selecionado` é o id em destaque (só no computador). */
  lista: (selecionado: string | null, selecionar: (id: string) => void) => ReactNode;
  ficha: (item: T) => ReactNode;
  /** Título acessível da ficha aberta no celular. */
  tituloFicha: (item: T) => string;
  /** Mostrado no lugar da lista e da ficha quando não há itens. */
  vazio: ReactNode;
}

/**
 * Lista + ficha ao lado. No computador (lg+), a ficha do item selecionado fica
 * fixa à direita e a seleção acompanha o filtro (se o item some, passa para o
 * primeiro). No celular, só a lista; tocar num item abre a ficha por cima.
 */
export function ListaFicha<T>({ itens, idDe, lista, ficha, tituloFicha, vazio }: ListaFichaProps<T>) {
  const desktop = useDesktop();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [abertoCelular, setAbertoCelular] = useState<string | null>(null);

  const ids = useMemo(() => itens.map(idDe), [itens, idDe]);
  const selecionado = selecaoValida(ids, escolhido);
  const itemSelecionado = selecionado === null ? undefined : itens[ids.indexOf(selecionado)];
  const itemCelular = abertoCelular === null ? undefined : itens[ids.indexOf(abertoCelular)];

  const selecionar = (id: string) => {
    setEscolhido(id);
    if (!desktop) setAbertoCelular(id);
  };

  if (itens.length === 0) return <>{vazio}</>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <div className="min-w-0 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
        {lista(desktop ? selecionado : null, selecionar)}
      </div>

      {desktop && itemSelecionado !== undefined && (
        <div className="hidden min-w-0 lg:block lg:sticky lg:top-4">{ficha(itemSelecionado)}</div>
      )}

      {!desktop && (
        <Sheet open={itemCelular !== undefined} onOpenChange={(v) => !v && setAbertoCelular(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md" aria-describedby={undefined}>
            {itemCelular !== undefined && (
              <>
                <SheetTitle className="sr-only">{tituloFicha(itemCelular)}</SheetTitle>
                <div className="pt-10">{ficha(itemCelular)}</div>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
