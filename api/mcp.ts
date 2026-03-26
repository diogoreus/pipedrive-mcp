import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";
import { PipedriveClient } from "../src/pipedrive/client.js";
import { FieldMapper } from "../src/pipedrive/fields.js";
import { TokenStore } from "../src/auth/token-store.js";
import { refreshAccessToken } from "../src/auth/oauth.js";

const fieldMapper = new FieldMapper();

function setCorsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Resolve user identity from Authorization header or cookie
  // Header format: Bearer <pipedrive-user-id>
  // Cookie format: pipedrive_uid=<pipedrive-user-id>
  // Resolve user identity: header > cookie > env default (for single-user/testing)
  const authHeader = req.headers.authorization;
  const cookieUserId = parseCookie(req.headers.cookie ?? "", "pipedrive_uid");
  const defaultUserId = process.env.DEFAULT_PIPEDRIVE_USER_ID;
  const userId = authHeader?.replace("Bearer ", "") || cookieUserId || defaultUserId;

  if (!userId) {
    res.status(401).json({
      error: "Not authenticated. Visit /api/auth/authorize to connect your Pipedrive account.",
    });
    return;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const tokenStore = new TokenStore(encryptionKey);

  let tokens = await tokenStore.retrieve(userId);
  if (!tokens) {
    res.status(401).json({
      error: `No tokens found for user ${userId}. Please authorize at /api/auth/authorize`,
    });
    return;
  }

  // Refresh token if expired (with 5-minute buffer)
  if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    try {
      tokens = await refreshAccessToken({
        refreshToken: tokens.refreshToken,
        clientId: process.env.PIPEDRIVE_CLIENT_ID!,
        clientSecret: process.env.PIPEDRIVE_CLIENT_SECRET!,
      });
      await tokenStore.store(userId, tokens);
    } catch {
      res.status(401).json({
        error: "Token refresh failed. Please re-authorize at /api/auth/authorize",
      });
      return;
    }
  }

  // Pipedrive api_domain may be "https://company-api.pipedrive.com" or similar.
  // Normalize to the company subdomain format that the API expects.
  const apiDomain = normalizeApiDomain(tokens.apiDomain);
  console.log(`Using apiDomain: ${apiDomain} (stored: ${tokens.apiDomain})`);

  const client = new PipedriveClient({
    accessToken: tokens.accessToken,
    apiDomain,
  });

  // Load field mapping (cached with 1h TTL)
  await fieldMapper.load({
    accessToken: tokens.accessToken,
    apiDomain,
  });

  try {
    const server = createServer({
      getClient: () => client,
      getFieldMapper: () => fieldMapper,
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.split(";").find((c) => c.trim().startsWith(`${name}=`));
  return match?.split("=")[1]?.trim();
}

function normalizeApiDomain(domain: string): string {
  // Pipedrive OAuth may return domains like:
  //   https://companydomain.pipedrive.com (correct)
  //   https://companydomain-api.pipedrive.com (needs fixing)
  //   https://api.pipedrive.com (generic, unusable)
  // We also handle the company_domain override from callback
  try {
    const url = new URL(domain);
    const host = url.hostname;

    // Already a company subdomain (not api.pipedrive.com)
    if (host.endsWith(".pipedrive.com") && !host.startsWith("api.")) {
      // Strip "-api" suffix if present: "company-api.pipedrive.com" -> "company.pipedrive.com"
      const subdomain = host.replace(".pipedrive.com", "").replace(/-api$/, "");
      return `https://${subdomain}.pipedrive.com`;
    }

    // Generic api.pipedrive.com — can't determine company, return as-is
    return domain;
  } catch {
    return domain;
  }
}
