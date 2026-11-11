/** Esqueleto genérico exibido enquanto uma página do /intranet ou /admin carrega. */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-slate-200/70" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-slate-200/50" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-white p-4">
            <div className="h-4 w-1/2 rounded bg-slate-200/70" />
            <div className="mt-3 h-3 w-3/4 rounded bg-slate-200/50" />
            <div className="mt-2 h-3 w-2/3 rounded bg-slate-200/50" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded-xl border border-border bg-white" />
    </div>
  );
}
