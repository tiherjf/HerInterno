import { waitUntil } from "@vercel/functions";

/**
 * Executa um trabalho de melhor esforço (e-mail, broadcast) DEPOIS da resposta.
 *
 * Numa função serverless não basta "não dar await": a Vercel pode congelar a
 * função logo após responder e o trabalho se perde. waitUntil mantém a função
 * viva até a promessa terminar. Fora da Vercel (dev) a promessa só roda solta.
 * Erros são engolidos e logados — nunca afetam a resposta já enviada.
 */
export function inBackground(label: string, task: () => Promise<unknown>) {
  waitUntil(
    task().catch((err) => {
      console.error(`[background:${label}]`, err);
    })
  );
}
