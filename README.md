# ZuzuCord Native

**ZuzuCord is now a native Windows desktop application written in C# with .NET 8 Windows Forms.** The previous Electron/web-wrapper implementation has been retired.

## What works in source

- A native Windows startup disclaimer requiring explicit acknowledgment on **every** app launch
- A native dark-theme interface, with servers, channels, and messages
- Sign-in using a **Discord bot token** (NOT a Discord user token)
- Read the servers that the bot belongs to
- Read text channels accessible to that bot
- Read recent channel messages (when bot permissions and message content access permit)
- Send messages **as that bot** to channels where permitted
- Manual refresh and basic error reporting

**This is a native Discord bot-channel dashboard, not a full replacement Discord user client.** Discord does not offer an officially supported way to recreate all normal user-client features through its bot API. This app has no Discord user login, friend DMs, user voice chat, or unofficial user-token automation. It does not load a website or embed a web browser.

## Build on Windows

Install the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0). In PowerShell:

```powershell
cd ZuzuCord.Native
dotnet restore
dotnet run
```

To create a standalone Windows build:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ./publish
```

The executable will be at `ZuzuCord.Native/publish/ZuzuCord.exe`.

## Discord configuration

Create a bot for a server you manage using Discord's official developer portal. Enable the **Message Content Intent** if needed to read message bodies (subject to Discord's requirements). Invite the bot with only the permissions it needs: View Channels, Read Message History, and Send Messages. Enter its bot token in the ZuzuCord connection box. The token is used in memory only and is not saved to disk. Treat bot tokens as secrets.

**Do not enter your personal Discord account token.** Do not commit a bot token to GitHub.

## Important risks

ZuzuCord is an independent third-party project, not affiliated with or approved by Discord Inc. The startup warning discloses potential account restrictions and bans from unsupported clients. It does not waive statutory rights. Use only official bot integration and follow Discord's developer policies.

## Status

Source created; the executable has **not been compiled or tested on Windows** in this environment. Discord permission scopes and intent settings affect features.
