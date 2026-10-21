# ZuzuCord branch structure

**main** — primary ZuzuCord Windows client and stable website source. Windows build/publish and website validation run on changes relevant to those components.

**beta-website** — beta testers' website branch. Contains the same core download/signup/stats functionality with experimental UI, an early access banner, and GitHub feedback links. This is intentionally a separate branch, not a new production deployment.

**feature/<short-name>** — recommended temporary branch convention for new features and changes needing review. Merge tested work into beta-website first if it affects the website; merge stable and reviewed code into main.

**hotfix/<short-name>** — recommended temporary branch convention for urgent production fixes.

GitHub branch names can't contain spaces, so the requested “beta website” is named `beta-website`.

When an experimental feature needs live testers, create a separate preview host project pointing to beta-website; keep main's domain unchanged. Verify C# CI and website checks before a public stable release.

Avoid storing tokens or service-role secrets in Git; server-only Edge Functions can use managed Supabase environment variables.
