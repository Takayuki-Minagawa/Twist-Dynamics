import { describe, expect, it } from "vitest";
import { decodeTextWithMeta, TextDecodingError } from "../src/io/text";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("text decoding", () => {
  it("prefers utf-8 when bytes are exact utf-8", () => {
    const bytes = new TextEncoder().encode("#ModalResult\n固有振動数");
    const decoded = decodeTextWithMeta(toArrayBuffer(bytes), "shift_jis");
    expect(decoded.encoding).toBe("utf-8");
    expect(decoded.text).toContain("固有振動数");
  });

  it("decodes shift_jis bytes when utf-8 fails", () => {
    const shiftJisBytes = new Uint8Array([0x82, 0xa0]);
    const decoded = decodeTextWithMeta(toArrayBuffer(shiftJisBytes), "utf-8");
    expect(decoded.encoding).toBe("shift_jis");
    expect(decoded.text).toBe("あ");
  });

  it("removes utf-8 bom when present", () => {
    const payload = new TextEncoder().encode("<ATV />");
    const bomBytes = new Uint8Array(3 + payload.length);
    bomBytes.set([0xef, 0xbb, 0xbf], 0);
    bomBytes.set(payload, 3);
    const decoded = decodeTextWithMeta(toArrayBuffer(bomBytes), "shift_jis");
    expect(decoded.hasBom).toBe(true);
    expect(decoded.text).toBe("<ATV />");
  });

  it("throws when content cannot be decoded safely", () => {
    const binaryLike = new Uint8Array([0xff, 0xff, 0xff]);
    expect(() => decodeTextWithMeta(toArrayBuffer(binaryLike), "shift_jis")).toThrow(
      TextDecodingError
    );
  });
});
