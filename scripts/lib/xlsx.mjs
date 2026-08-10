/**
 * Leitor mínimo de .xlsx (zip + inflate raw), sem dependências externas.
 * Suficiente para as planilhas exportadas do sistema (strings compartilhadas,
 * inline strings e números). Não interpreta fórmulas nem formatos de data.
 */
import { readFileSync } from "fs";
import { inflateRawSync } from "zlib";

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Arquivo .xlsx inválido (EOCD não encontrado).");
  const nEntries = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let e = 0; e < nEntries; e++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("Diretório central do zip inválido.");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const dataStart = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? raw : inflateRawSync(raw);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unesc = (s) =>
  s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const colNum = (ref) => {
  let n = 0;
  for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Lê `caminho` e devolve { [nomeDaAba]: linhas[][] } com todas as células como texto. */
export function lerXlsx(caminho) {
  const files = unzip(readFileSync(caminho));

  const ss = [];
  for (const si of (files["xl/sharedStrings.xml"]?.toString("utf8") ?? "").split("<si>").slice(1)) {
    let t = "";
    for (const m of si.split("</si>")[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += unesc(m[1]);
    ss.push(t);
  }

  const rels = {};
  for (const m of files["xl/_rels/workbook.xml.rels"].toString("utf8").matchAll(/Id="rId(\d+)"[^>]*Target="([^"]*)"/g)) {
    rels[+m[1]] = m[2];
  }

  const abas = {};
  const wb = files["xl/workbook.xml"].toString("utf8");
  for (const m of wb.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="rId(\d+)"/g)) {
    let target = rels[+m[2]];
    if (!target) continue;
    if (!target.startsWith("xl/")) target = "xl/" + target.replace(/^\//, "");
    const buf = files[target];
    if (!buf) continue;

    const linhas = [];
    for (const rm of buf.toString("utf8").matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cels = [];
      for (const cm of rm[1].matchAll(/<c ([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = (cm[1].match(/r="([A-Z]+\d+)"/) || [])[1];
        if (!ref) continue;
        const t = (cm[1].match(/t="([^"]+)"/) || [])[1];
        const corpo = cm[3] ?? "";
        let val = "";
        if (t === "inlineStr") {
          for (const im of corpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) val += unesc(im[1]);
        } else {
          const v = (corpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          if (v != null) val = t === "s" ? (ss[+v] ?? "") : unesc(v);
        }
        cels[colNum(ref)] = val;
      }
      linhas.push(Array.from(cels, (c) => c ?? ""));
    }
    abas[unesc(m[1])] = linhas;
  }
  return abas;
}
