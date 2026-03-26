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

    const userRes = await fetch(`${tokens.apiDomain}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const userData = await userRes.json();
    const userId = String(userData.data.id);

    const tokenStore = new TokenStore(encryptionKey);
    await tokenStore.store(userId, tokens);

    res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Connected to Pipedrive</h1>
          <p>Your Pipedrive user ID is: <strong>${userId}</strong></p>
          <p>Add this to your Claude Code MCP config headers to authenticate.</p>
          <p>You can close this page.</p>
        </body>
      </html>
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
