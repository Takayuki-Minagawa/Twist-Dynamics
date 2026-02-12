export function decodeText(
  source: ArrayBuffer,
  preferred: "shift_jis" | "utf-8" = "shift_jis"
): string {
  const order: Array<"shift_jis" | "utf-8"> =
    preferred === "shift_jis" ? ["shift_jis", "utf-8"] : ["utf-8", "shift_jis"];

  let fallback = "";
  for (const encoding of order) {
    try {
      const text = new TextDecoder(encoding, { fatal: false }).decode(source);
      if (encoding === "shift_jis" && text.includes("�")) {
        fallback = text;
        continue;
      }
      return text;
    } catch {
      // try next encoding
    }
  }
  return fallback;
}

export function normalizeNewLines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function splitCsvLikeLine(line: string): string[] {
  return line.split(",").map((token) => token.trim());
}

export function toNumberList(tokens: string[]): number[] {
  return tokens
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
}
