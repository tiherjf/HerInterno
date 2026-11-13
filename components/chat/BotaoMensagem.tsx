import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { linkConversa } from "@/lib/chat-interno/link";

/** Atalho "Mandar mensagem" para a pessoa (não aparece para o próprio usuário). */
export function BotaoMensagem({ profileId, nome, meuId }: { profileId: string; nome: string; meuId: string }) {
  if (!profileId || profileId === meuId) return null;
  const rotulo = `Mandar mensagem para ${nome}`;
  return (
    <Link
      href={linkConversa(profileId)}
      aria-label={rotulo}
      title={rotulo}
      className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-accent hover:text-primary no-print"
    >
      <MessageCircle size={14} />
    </Link>
  );
}
