import { normalizarTexto } from "../../components/corpo-clinico/agenda";

/**
 * Acrescenta etiquetas vindas de um texto separado por vírgula: tira espaços,
 * ignora vazias e repetidas (sem acento e sem caixa), mantém a ordem.
 */
export function adicionarTags(atuais: string[], texto: string): string[] {
  const resultado = [...atuais];
  const vistos = new Set(atuais.map((t) => normalizarTexto(t).trim()));
  for (const parte of texto.split(",")) {
    const tag = parte.trim();
    const chave = normalizarTexto(tag);
    if (!tag || vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(tag);
  }
  return resultado;
}
