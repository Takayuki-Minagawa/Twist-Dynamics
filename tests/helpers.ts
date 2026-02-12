import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeText } from "../src/io/text";

export function readFixture(pathFromRoot: string): string {
  const abs = resolve(process.cwd(), pathFromRoot);
  const raw = readFileSync(abs);
  const source = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return decodeText(source, "shift_jis");
}
