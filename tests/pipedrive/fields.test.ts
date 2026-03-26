import { describe, it, expect, vi, beforeEach } from "vitest";
import { FieldMapper } from "../../src/pipedrive/fields.js";
import { mockFetchSuccess } from "../helpers/mock-pipedrive.js";

describe("FieldMapper", () => {
  let mapper: FieldMapper;

  beforeEach(() => {
    mapper = new FieldMapper();
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        { key: "title", name: "Title", field_type: "varchar", is_custom_field: false },
        { key: "abc123_custom", name: "Lead Source", field_type: "enum", is_custom_field: true },
        { key: "def456_custom", name: "Revenue Target", field_type: "monetary", is_custom_field: true },
      ])
    );
  });

  it("loads fields and maps key to name", async () => {
    await mapper.load({ accessToken: "token", apiDomain: "https://company.pipedrive.com" });
    expect(mapper.keyToName("abc123_custom")).toBe("Lead Source");
    expect(mapper.keyToName("title")).toBe("Title");
  });

  it("maps name to key for custom fields", async () => {
    await mapper.load({ accessToken: "token", apiDomain: "https://company.pipedrive.com" });
    expect(mapper.nameToKey("Lead Source")).toBe("abc123_custom");
    expect(mapper.nameToKey("Revenue Target")).toBe("def456_custom");
  });

  it("returns key as-is if not found", async () => {
    await mapper.load({ accessToken: "token", apiDomain: "https://company.pipedrive.com" });
    expect(mapper.keyToName("unknown_key")).toBe("unknown_key");
    expect(mapper.nameToKey("Unknown Field")).toBe("Unknown Field");
  });

  it("translates custom fields in a deal response", async () => {
    await mapper.load({ accessToken: "token", apiDomain: "https://company.pipedrive.com" });
    const deal = { id: 1, title: "Big Deal", abc123_custom: "Website", def456_custom: 50000 };
    const translated = mapper.translateResponse(deal);
    expect(translated["Lead Source"]).toBe("Website");
    expect(translated["Revenue Target"]).toBe(50000);
    expect(translated["abc123_custom"]).toBeUndefined();
  });

  it("resolves human-readable field names for write params", async () => {
    await mapper.load({ accessToken: "token", apiDomain: "https://company.pipedrive.com" });
    const params = { "Lead Source": "Referral" };
    const resolved = mapper.resolveWriteFields(params);
    expect(resolved).toEqual({ abc123_custom: "Referral" });
  });
});
