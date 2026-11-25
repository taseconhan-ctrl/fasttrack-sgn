# Fast Track SGN – Sending API

This Worker is a private backend for the GitHub Pages frontend. **Never commit API tokens, OAuth secrets, or the shared secret.**

## Cloudflare setup
1. Create a Cloudflare account and install Wrangler.
2. Create a D1 database: `npx wrangler d1 create fasttrack-sgn-sendlog`.
3. Put the returned database ID in `wrangler.toml`.
4. Set secrets:
   - `npx wrangler secret put APP_SHARED_SECRET`
   - `npx wrangler secret put WHATSAPP_ACCESS_TOKEN`
   - `npx wrangler secret put GOOGLE_CLIENT_ID`
   - `npx wrangler secret put GOOGLE_CLIENT_SECRET`
   - `npx wrangler secret put GOOGLE_REFRESH_TOKEN`
   - `npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID`
5. Set vars in Wrangler dashboard: `ALLOWED_ORIGINS=https://taseconhan-ctrl.github.io` and optionally `GRAPH_API_VERSION=v23.0`.
6. Deploy with `npx wrangler deploy`.

## Gmail OAuth
Create an OAuth client in Google Cloud, enable Gmail API, request the `https://www.googleapis.com/auth/gmail.send` scope, and obtain a refresh token for the sending mailbox. Store all OAuth values as Worker secrets.

## WhatsApp
Use a WhatsApp Business Platform Cloud API number and its Phone Number ID/access token. For an existing WhatsApp Business App number, confirm Meta Coexistence eligibility and complete Meta's official Embedded Signup before using Cloud API. Free-form text is only accepted when the 24-hour customer-service window is open. Outside that window, send an approved template; this endpoint accepts the approved template name and language.

## Safety / operational notes
- The browser sends one booking/channel request at a time after explicit user confirmation.
- D1 enforces one attempt per booking and channel. A failed attempt remains recorded; inspect the log before manually deciding whether to retry.
- Do not send real customer data to a test deployment.
- Configure the frontend's Worker URL and shared secret locally; do not put them in this repository.
