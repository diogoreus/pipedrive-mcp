import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildAuthorizeUrl } from "../../src/auth/oauth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "PIPEDRIVE_CLIENT_ID not configured" });
    return;
  }

  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  const url = buildAuthorizeUrl({ clientId, redirectUri });
  res.redirect(302, url);
}
