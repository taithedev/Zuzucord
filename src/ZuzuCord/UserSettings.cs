using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ZuzuCord;

internal sealed class UserSettings
{
    public bool SetupCompleted { get; set; }
    public bool RememberLogin { get; set; } = true;
    public bool BetaSyncEnabled { get; set; }
    public string Theme { get; set; } = "oled";
    public string Accent { get; set; } = "#c9c9d2";
    public int WindowWidth { get; set; } = 1270;
    public int WindowHeight { get; set; } = 800;

    private static readonly string Root = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZuzuCord");
    private static readonly string SettingsPath = Path.Combine(Root, "settings.json");

    public static UserSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsPath)) return new UserSettings();
            var data = JsonSerializer.Deserialize<UserSettings>(File.ReadAllText(SettingsPath)) ?? new UserSettings();
            data.Theme = ThemeColors.NormalizeTheme(data.Theme);
            data.Accent = ThemeColors.NormalizeAccent(data.Accent);
            data.WindowWidth = Math.Clamp(data.WindowWidth, 850, 3000);
            data.WindowHeight = Math.Clamp(data.WindowHeight, 550, 1800);
            return data;
        }
        catch { return new UserSettings(); }
    }

    public void Save()
    {
        Directory.CreateDirectory(Root);
        var temporary = SettingsPath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporary, SettingsPath, true);
    }

    internal static string VaultPath => Path.Combine(Root, "login.bin");
    internal static void CreateRoot() => Directory.CreateDirectory(Root);
}

internal static class LoginVault
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("ZuzuCord-Windows-Refresh-v1");

    public static void Save(string refreshToken)
    {
        UserSettings.CreateRoot();
        // DPAPI encrypts a refresh token for this Windows account only.
        var secret = ProtectedData.Protect(Encoding.UTF8.GetBytes(refreshToken),
            Entropy, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(UserSettings.VaultPath, secret);
    }

    public static string? Read()
    {
        try
        {
            if (!File.Exists(UserSettings.VaultPath)) return null;
            var raw = ProtectedData.Unprotect(File.ReadAllBytes(UserSettings.VaultPath),
                Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(raw);
        }
        catch
        {
            Clear();
            return null;
        }
    }

    public static void Clear()
    {
        try { File.Delete(UserSettings.VaultPath); } catch { }
    }
}
