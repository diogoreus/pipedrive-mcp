import { kv } from "@vercel/kv";
import { encrypt, decrypt } from "./encryption.js";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apiDomain: string;
}

const KEY_PREFIX = "tokens:";

export class TokenStore {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  async store(userId: string, tokens: StoredTokens): Promise<void> {
    const plaintext = JSON.stringify(tokens);
    const encrypted = encrypt(plaintext, this.encryptionKey);
    await kv.set(`${KEY_PREFIX}${userId}`, encrypted);
  }

  async retrieve(userId: string): Promise<StoredTokens | null> {
    const encrypted = await kv.get<string>(`${KEY_PREFIX}${userId}`);
    if (!encrypted) return null;
    const plaintext = decrypt(encrypted, this.encryptionKey);
    return JSON.parse(plaintext) as StoredTokens;
  }

  async delete(userId: string): Promise<void> {
    await kv.del(`${KEY_PREFIX}${userId}`);
  }
}
