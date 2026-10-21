# ZuzuCord

ZuzuCord is an independent, unofficial Discord desktop wrapper made with Electron. It loads Discord's official web interface in a desktop window.

## Current features

- Mandatory account-ban and policy warning **on every launch**
- Required risk acknowledgment checkbox before opening Discord
- Dedicated resizable Discord window
- Persistent browser session for sign-in
- External site links open in the default browser
- Electron sandbox and context isolation
- Windows installer build script

## Run the application

Install Node.js LTS and run:

```bash
npm install
npm start
```

## Build a Windows installer

```bash
npm install
npm run build:win
```

The installer will be written to `dist/`. Builds and compatibility have not yet been verified on a Windows machine.

## Important account-risk notice

Unofficial Discord clients may be unsupported and may violate Discord's terms or policies. Using one may lead to account restrictions, suspension, or a ban. ZuzuCord is not affiliated with, sponsored by, or endorsed by Discord Inc., and its developers cannot prevent or reverse Discord's enforcement decisions. The startup notice does not waive legal rights or absolve unlawful conduct.

For the officially supported experience, use Discord's official desktop application or https://discord.com/app.

## Limitations

This release is a **web wrapper**, not an independently implemented Discord API client or a custom Discord UI. It does not use automated user accounts, ask for raw user tokens, inject scripts into Discord, or promise compatibility with every Discord feature. Discord can change its website at any time.

## Source files

- `main.js`: Electron application and website navigation
- `preload.js`: minimal, isolated notice controls
- `notice.html`: mandatory pre-launch disclaimer
- `package.json`: dependencies and build commands

See CONTRIBUTING.md and SECURITY.md for project policies.
