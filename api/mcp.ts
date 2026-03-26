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

async function resolveClient(): Promise<{ accessToken: string; apiDomain: string } | null> {
  // Mode 1: API token + company domain (simplest, for internal use)
  const apiToken = process.env.PIPEDRIVE_API_TOKEN;
  const companyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN;
  if (apiToken && companyDomain) {
    return {
      accessToken: apiToken,
      apiDomain: companyDomain.startsWith("https://") ? companyDomain : `https://${companyDomain}`,
    };
  }

  // Mode 2: OAuth (for multi-user, when configured)
  // Falls through to the OAuth flow below
  return null;
}

async function resolveOAuthClient(
  userId: string
): Promise<{ accessToken: string; apiDomain: string } | null> {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) return null;

  const tokenStore = new TokenStore(encryptionKey);
  let tokens = await tokenStore.retrieve(userId);
  if (!tokens) return null;

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
      return null;
    }
  }

  return {
    accessToken: tokens.accessToken,
    apiDomain: tokens.apiDomain,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Try API token mode first (no per-user auth needed)
  let credentials = await resolveClient();

  // Fall back to OAuth mode
  if (!credentials) {
    const authHeader = req.headers.authorization;
    const cookieUserId = parseCookie(req.headers.cookie ?? "", "pipedrive_uid");
    const defaultUserId = process.env.DEFAULT_PIPEDRIVE_USER_ID;
    const userId = authHeader?.replace("Bearer ", "") || cookieUserId || defaultUserId;

    if (!userId) {
      res.status(401).json({
        error: "Not authenticated. Visit /api/auth/authorize or set PIPEDRIVE_API_TOKEN env var.",
      });
      return;
    }

    credentials = await resolveOAuthClient(userId);
    if (!credentials) {
      res.status(401).json({
        error: `Auth failed for user ${userId}. Re-authorize at /api/auth/authorize`,
      });
      return;
    }
  }

  const client = new PipedriveClient({
    accessToken: credentials.accessToken,
    apiDomain: credentials.apiDomain,
  });

  await fieldMapper.load({
    accessToken: credentials.accessToken,
    apiDomain: credentials.apiDomain,
  });

  try {
    const server = createServer({
      getClient: () => client,
      getFieldMapper: () => fieldMapper,
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
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
