import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exchangeCodeForTokens } from "../../src/auth/oauth.js";
import { TokenStore } from "../../src/auth/token-store.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  const clientId = process.env.PIPEDRIVE_CLIENT_ID!;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET!;
  const encryptionKey = process.env.ENCRYPTION_KEY!;

  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    // Fetch user info to get user ID and correct company domain
    const userRes = await fetch(`${tokens.apiDomain}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const userData = (await userRes.json()) as {
      data: { id: number; company_domain: string };
    };
    const userId = String(userData.data.id);

    // Pipedrive OAuth returns api_domain like "https://api.pipedrive.com"
    // but API calls must go to the company-specific subdomain
    const companyDomain = userData.data.company_domain;
    if (companyDomain) {
      tokens.apiDomain = `https://${companyDomain}.pipedrive.com`;
    }

    const tokenStore = new TokenStore(encryptionKey);
    await tokenStore.store(userId, tokens);

    // Set session cookie so MCP clients (like Claude Cowork) can authenticate
    // without custom headers. The cookie contains the Pipedrive user ID.
    res.setHeader("Set-Cookie", `pipedrive_uid=${userId}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=31536000`);

    res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Connected to Pipedrive</h1>
          <p>Your Pipedrive user ID is: <strong>${userId}</strong></p>
          <p>You're all set. You can close this page.</p>
          <p style="color: #666; font-size: 14px;">For Claude Code CLI, add header: Authorization: Bearer ${userId}</p>
        </body>
      </html>
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
