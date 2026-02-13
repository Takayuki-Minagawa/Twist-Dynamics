export type SupportedTextEncoding = "utf-8" | "shift_jis" | "utf-16le" | "utf-16be";

export interface DecodedTextResult {
  text: string;
  encoding: SupportedTextEncoding;
  hasBom: boolean;
  warnings: string[];
}

interface DecodeCandidate {
  encoding: SupportedTextEncoding;
  text: string;
  score: number;
}

const ENCODING_FALLBACK_ORDER: SupportedTextEncoding[] = [
  "utf-8",
  "shift_jis",
  "utf-16le",
  "utf-16be"
];

export class TextDecodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TextDecodingError";
  }
}

export class FormatParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormatParseError";
  }
}

function dedupeEncodings(encodings: SupportedTextEncoding[]): SupportedTextEncoding[] {
  const ordered: SupportedTextEncoding[] = [];
  for (const encoding of encodings) {
    if (!ordered.includes(encoding)) ordered.push(encoding);
  }
  return ordered;
}

function detectBom(bytes: Uint8Array): SupportedTextEncoding | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  return null;
}

function stripBom(bytes: Uint8Array, encoding: SupportedTextEncoding): Uint8Array {
  if (encoding === "utf-8") return bytes.subarray(3);
  if (encoding === "utf-16le" || encoding === "utf-16be") return bytes.subarray(2);
  return bytes;
}

function decodeStrict(bytes: Uint8Array, encoding: SupportedTextEncoding): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function hasManyControlChars(text: string): boolean {
  const controls = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g)?.length ?? 0;
  if (controls === 0) return false;
  return controls / Math.max(text.length, 1) > 0.01;
}

function looksLikeStructuredText(text: string): boolean {
  return /^\s*[<{#\[]/.test(text);
}

function isExactUtf8RoundTrip(bytes: Uint8Array, text: string): boolean {
  const encoded = new TextEncoder().encode(text);
  if (encoded.length !== bytes.length) return false;
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] !== bytes[i]) return false;
  }
  return true;
}

function scoreCandidate(
  encoding: SupportedTextEncoding,
  preferred: SupportedTextEncoding,
  bytes: Uint8Array,
  text: string
): number {
  let score = encoding === preferred ? 8 : 0;
  if (looksLikeStructuredText(text)) score += 4;
  if (text.length > 0) score += 1;
  if (text.includes("\uFFFD")) score -= 100;
  if (hasManyControlChars(text)) score -= 50;
  if (encoding === "utf-8" && isExactUtf8RoundTrip(bytes, text)) score += 100;
  return score;
}

export function decodeTextWithMeta(
  source: ArrayBuffer,
  preferred: SupportedTextEncoding = "shift_jis"
): DecodedTextResult {
  const bytes = new Uint8Array(source);
  const bomEncoding = detectBom(bytes);

  if (bomEncoding) {
    const raw = stripBom(bytes, bomEncoding);
    const text = decodeStrict(raw, bomEncoding);
    if (text === null) {
      throw new TextDecodingError(
        "BOM was found but the file could not be decoded. Save as UTF-8 (no BOM) or Shift_JIS."
      );
    }
    return {
      text,
      encoding: bomEncoding,
      hasBom: true,
      warnings: ["BOM was detected and removed while decoding."]
    };
  }

  const candidates: DecodeCandidate[] = [];
  const order = dedupeEncodings([preferred, ...ENCODING_FALLBACK_ORDER]);

  for (const encoding of order) {
    const text = decodeStrict(bytes, encoding);
    if (text === null) continue;
    candidates.push({
      encoding,
      text,
      score: scoreCandidate(encoding, preferred, bytes, text)
    });
  }

  if (candidates.length === 0) {
    throw new TextDecodingError(
      "Unsupported character encoding. Supported encodings: UTF-8, Shift_JIS, UTF-16LE, UTF-16BE."
    );
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best.score < -10) {
    throw new TextDecodingError(
      "Unable to decode text safely. Re-save the file as UTF-8 (no BOM) or Shift_JIS and retry."
    );
  }

  const warnings: string[] = [];
  if (best.encoding !== preferred) {
    warnings.push(`Input was decoded as ${best.encoding} instead of preferred ${preferred}.`);
  }

  return {
    text: best.text,
    encoding: best.encoding,
    hasBom: false,
    warnings
  };
}

export function decodeText(
  source: ArrayBuffer,
  preferred: SupportedTextEncoding = "shift_jis"
): string {
  return decodeTextWithMeta(source, preferred).text;
}

export function normalizeNewLines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function toTrimmedLines(text: string): string[] {
  return normalizeNewLines(text)
    .split("\n")
    .map((line) => line.trimEnd());
}

interface SectionOptions {
  sectionName: string;
  startMarker: string;
  endMarker?: string;
}

interface SectionSlice {
  startIndex: number;
  endIndex: number;
  before: string[];
  body: string[];
}

export function extractMarkedSection(lines: string[], options: SectionOptions): SectionSlice {
  const startIndex = lines.findIndex((line) => line.includes(options.startMarker));
  if (startIndex < 0) {
    throw new FormatParseError(
      `${options.sectionName}: required marker "${options.startMarker}" was not found.`
    );
  }

  let detectedEndIndex = lines.length;
  if (options.endMarker !== undefined) {
    const endMarker = options.endMarker;
    detectedEndIndex = lines.findIndex((line, i) => i > startIndex && line.includes(endMarker));
  }
  const endIndex = detectedEndIndex > startIndex ? detectedEndIndex : lines.length;

  return {
    startIndex,
    endIndex,
    before: lines.slice(0, startIndex),
    body: lines.slice(startIndex + 1, endIndex)
  };
}

export function splitCsvLikeLine(line: string): string[] {
  return line.split(",").map((token) => token.trim());
}

export function toNumberList(tokens: string[]): number[] {
  return tokens
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
}

export function parseNumberToken(token: string, label: string): number {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new FormatParseError(`${label}: empty value is not allowed.`);
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new FormatParseError(`${label}: "${token}" is not a valid number.`);
  }
  return value;
}

interface StrictNumberListOptions {
  allowEmpty?: boolean;
}

export function toNumberListStrict(
  tokens: string[],
  label: string,
  options: StrictNumberListOptions = {}
): number[] {
  const allowEmpty = options.allowEmpty ?? false;
  if (!allowEmpty && tokens.length === 0) {
    throw new FormatParseError(`${label}: value list is empty.`);
  }
  return tokens.map((token, index) => parseNumberToken(token, `${label}[${index}]`));
}
