/**
 * Redimensiona e comprime uma imagem NO NAVEGADOR antes do upload.
 *
 * Sem isso as capas iam para o storage como vieram (ex.: PNG de 3,4 MB) e eram
 * baixadas inteiras a cada abertura da home/notícias. Converte para WebP
 * (JPEG se o navegador não gerar WebP), limitando o maior lado a `maxSize`.
 *
 * Devolve o arquivo original quando não vale a pena mexer: GIF (pode ser
 * animado), SVG (vetor), falha de decodificação, ou se o resultado não ficou
 * menor que o original.
 */
export async function compressImage(
  file: File,
  { maxSize = 1600, quality = 0.82 }: { maxSize?: number; quality?: number } = {}
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // from-image: respeita a orientação EXIF de fotos tiradas no celular
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  // Navegadores sem encoder WebP devolvem PNG no lugar — aí cai para JPEG
  let blob = await toBlob("image/webp");
  let ext = "webp";
  if (!blob || blob.type !== "image/webp") {
    // JPEG não tem transparência: pinta fundo branco para PNGs com alpha
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    blob = await toBlob("image/jpeg");
    ext = "jpg";
  }

  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";
  return new File([blob], `${baseName}.${ext}`, { type: blob.type, lastModified: Date.now() });
}
