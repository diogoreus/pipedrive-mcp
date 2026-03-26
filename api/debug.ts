import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TokenStore } from "../src/auth/token-store.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.uid as string || process.env.DEFAULT_PIPEDRIVE_USER_ID;
  if (!userId) {
    res.status(400).json({ error: "No user ID" });
    return;
  }

  const tokenStore = new TokenStore(process.env.ENCRYPTION_KEY!);
  const tokens = await tokenStore.retrieve(userId);

  if (!tokens) {
    res.status(404).json({ error: "No tokens found", userId });
    return;
  }

  // Only show domain, not actual tokens
  res.json({
    userId,
    apiDomain: tokens.apiDomain,
    expiresAt: new Date(tokens.expiresAt).toISOString(),
    hasAccessToken: !!tokens.accessToken,
    hasRefreshToken: !!tokens.refreshToken,
  });
}
