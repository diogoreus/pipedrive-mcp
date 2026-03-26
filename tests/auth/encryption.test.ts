import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../../src/auth/encryption.js";

describe("encryption", () => {
  const key = "a".repeat(64); // 32 bytes hex-encoded

  it("encrypts and decrypts a string", () => {
    const plaintext = "my-secret-token";
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted, key)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with wrong key", () => {
    const encrypted = encrypt("secret", key);
    const wrongKey = "b".repeat(64);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("handles empty string", () => {
    const encrypted = encrypt("", key);
    expect(decrypt(encrypted, key)).toBe("");
  });

  it("handles unicode", () => {
    const text = "hello 世界 🌍";
    const encrypted = encrypt(text, key);
    expect(decrypt(encrypted, key)).toBe(text);
  });
});
