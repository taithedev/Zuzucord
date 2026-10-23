# Python bots for ZuzuCord

Create a bot in the **ZuzuCord desktop app → Developer Workspace** (requires a developer role). Issue a ZuzuCord bot token, store it privately, and ask the community owner to install the bot in their server. The server must approve a bot before it can post.

This example sends a real message through the deployed **zuzucord-bot-api** Supabase Edge Function using a ZuzuCord token. It does **not** use Discord tokens and cannot post to Discord servers. Python 3.10+ and the standard library are sufficient.

## Run locally

On PowerShell, set these variables in the current terminal (never commit actual token values):

```powershell
$env:ZUZUCORD_BOT_TOKEN = "<your newly issued ZuzuCord bot token>"
$env:ZUZUCORD_CHANNEL_ID = "<ZuzuCord channel UUID>"
python bot.py "Hello from Python"
```

The endpoint is set for the official ZuzuCord Supabase project. For a fork, set `ZUZUCORD_BOT_API_URL` to your own deployed function URL.

A successful response returns the message ID. Invalid or revoked credentials, uninstalled bots, missing channel access, rate limits and disabled bots produce an error. The backend enforces a minimum 3-second delay between messages per bot and a daily limit; do not loop on errors.

## Security

Keep bot tokens in server environment variables or a secrets manager. Never add them to your repository, distribute them inside a downloadable app, or paste them into chats. Rotate or revoke tokens in Developer Workspace if exposed. The Python bot uses only the scoped ZuzuCord bot token. No Supabase service-role key is needed.
