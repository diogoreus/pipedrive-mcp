import type { DealField } from "./types.js";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class FieldMapper {
  private keyToNameMap = new Map<string, string>();
  private nameToKeyMap = new Map<string, string>();
  private customKeys = new Set<string>();
  private loadedAt = 0;

  async load(config: { accessToken: string; apiDomain: string }): Promise<void> {
    if (Date.now() - this.loadedAt < CACHE_TTL_MS && this.keyToNameMap.size > 0) {
      return;
    }

    // Try v1 endpoint — v2 may require additional scopes
    const url = `${config.apiDomain}/api/v1/dealFields?api_token=${config.accessToken}&limit=500`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`Failed to load deal fields: ${res.status}. Custom field translation disabled.`);
      this.loadedAt = Date.now(); // Prevent retrying on every request
      return;
    }

    const json = (await res.json()) as { data: DealField[] };
    const fields: DealField[] = json.data;

    const newKeyToName = new Map<string, string>();
    const newNameToKey = new Map<string, string>();
    const newCustomKeys = new Set<string>();

    for (const field of fields) {
      newKeyToName.set(field.key, field.name);
      newNameToKey.set(field.name, field.key);
      if (field.is_custom_field) {
        newCustomKeys.add(field.key);
      }
    }

    this.keyToNameMap = newKeyToName;
    this.nameToKeyMap = newNameToKey;
    this.customKeys = newCustomKeys;
    this.loadedAt = Date.now();
  }

  keyToName(key: string): string {
    return this.keyToNameMap.get(key) ?? key;
  }

  nameToKey(name: string): string {
    return this.nameToKeyMap.get(name) ?? name;
  }

  isCustomField(key: string): boolean {
    return this.customKeys.has(key);
  }

  translateResponse(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.customKeys.has(key)) {
        result[this.keyToName(key)] = value;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  resolveWriteFields(params: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(params)) {
      result[this.nameToKey(name)] = value;
    }
    return result;
  }
}
