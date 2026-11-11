import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";

export interface HeroNewsItem {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  cover_url: string | null;
}

/** Notícia em destaque da página inicial: foto de fundo com degradê, ou cartão azul-claro sem foto. */
export function HeroNews({ news }: { news: HeroNewsItem }) {
  const href = `/intranet/noticias/${news.id}`;

  if (!news.cover_url) {
    return (
      <Link
        href={href}
        className="group flex flex-col gap-2 rounded-2xl border border-border bg-accent p-6 transition-shadow hover:shadow-md"
      >
        <span className="flex w-max items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <Newspaper size={12} /> {news.category}
        </span>
        <h2 className="text-xl font-bold text-slate-900 group-hover:text-primary md:text-2xl">{news.title}</h2>
        {news.summary && <p className="line-clamp-2 text-sm text-slate-600">{news.summary}</p>}
        <span className="mt-1 flex items-center gap-1 text-sm font-medium text-primary">
          Ler notícia <ArrowRight size={14} />
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className="group relative flex h-56 flex-col justify-end overflow-hidden rounded-2xl md:h-72">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={news.cover_url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/35 to-transparent" />
      <div className="relative space-y-2 p-5 text-white md:p-7">
        <span className="inline-block rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          {news.category}
        </span>
        <h2 className="max-w-3xl text-xl font-bold leading-tight md:text-3xl">{news.title}</h2>
        {news.summary && <p className="line-clamp-2 max-w-2xl text-sm text-white/85">{news.summary}</p>}
      </div>
    </Link>
  );
}
