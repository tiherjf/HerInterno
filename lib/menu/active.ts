/**
 * Qual link do menu deve ficar aceso para a rota atual: o mais específico que
 * casa (a própria rota ou um "pai" dela). Raízes de área — /intranet, /admin —
 * só acendem na própria página, senão ficariam acesas junto com tudo.
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const isRoot = href.split("/").filter(Boolean).length <= 1;
    const matches = pathname === href || (!isRoot && pathname.startsWith(href + "/"));
    if (matches && (!best || href.length > best.length)) best = href;
  }
  return best;
}
