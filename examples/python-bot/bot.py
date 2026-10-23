"""Minimal ZuzuCord bot: posts to an authorized server channel with its own token.

Python 3.10+, standard library only. No Discord token or service-role key needed.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_URL = "https://wfqudstuncdldsvxqveu.supabase.co/functions/v1/zuzucord-bot-api"


def send_message(channel_id: str, content: str) -> str:
    """Send one message to a server that installed this bot."""
    token = os.environ.get("ZUZUCORD_BOT_TOKEN", "").strip()
    if not token:
        raise ValueError("Set ZUZUCORD_BOT_TOKEN in your environment.")
    if not channel_id or not content.strip():
        raise ValueError("Provide a channel ID and nonempty message.")
    if len(content) > 1500:
        raise ValueError("Message must be 1–1500 characters.")
    api_url = os.environ.get("ZUZUCORD_BOT_API_URL", DEFAULT_URL).strip()
    body = json.dumps({"action": "send", "channel_id": channel_id, "content": content}).encode("utf-8")
    request = urllib.request.Request(
        api_url,
        data=body,
        headers={"Content-Type": "application/json", "x-zuzucord-bot-token": token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        # Do not print the token, request headers or server secrets.
        detail = error.read(2048).decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("error", detail)
        except ValueError:
            pass
        raise RuntimeError(f"ZuzuCord rejected message ({error.code}): {detail}") from error
    if not payload.get("success"):
        raise RuntimeError(str(payload.get("error", "Message not accepted.")))
    return str(payload["message_id"])


if __name__ == "__main__":
    channel = os.environ.get("ZUZUCORD_CHANNEL_ID", "").strip()
    message = " ".join(sys.argv[1:]).strip() or "Hello from my Python ZuzuCord bot."
    try:
        posted = send_message(channel, message)
        print("Sent ZuzuCord message ID:", posted)
    except (RuntimeError, ValueError, urllib.error.URLError) as error:
        print(f"Bot error: {error}", file=sys.stderr)
        sys.exit(1)
