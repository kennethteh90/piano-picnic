/** Read tEXt chunks from a PNG ArrayBuffer (browser or node). */

export type PngTextChunk = { keyword: string; text: string };

export function readPngTextChunks(buffer: ArrayBuffer): PngTextChunk[] {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) return [];
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return [];
  }

  const chunks: PngTextChunk[] = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;

    if (type === "tEXt" && length > 0) {
      let zero = dataStart;
      while (zero < dataEnd && bytes[zero] !== 0) zero += 1;
      const keyword = new TextDecoder().decode(bytes.subarray(dataStart, zero));
      const text = new TextDecoder().decode(bytes.subarray(zero + 1, dataEnd));
      chunks.push({ keyword, text });
    }

    offset = dataEnd + 4;
    if (type === "IEND") break;
  }
  return chunks;
}

export function readPngKeywordJson<T>(buffer: ArrayBuffer, keyword: string): T | null {
  const chunk = readPngTextChunks(buffer).find((c) => c.keyword === keyword);
  if (!chunk) return null;
  try {
    return JSON.parse(chunk.text) as T;
  } catch {
    return null;
  }
}
