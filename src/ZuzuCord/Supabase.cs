using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ZuzuCord;

internal sealed record Room(Guid Id, string Name, string Description);
internal sealed record ChatMessage(
    Guid Id,
    [property: JsonPropertyName("author_id")] Guid AuthorId,
    string Content,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    [property: JsonPropertyName("bot_name")] string? BotName = null);
internal sealed record FriendRequest(Guid Id,
    [property: JsonPropertyName("from_user")] Guid FromUser,
    [property: JsonPropertyName("to_user")] Guid ToUser, string Status);
internal sealed record DirectoryResult(
    [property: JsonPropertyName("user_id")] Guid UserId, string Username);
internal sealed record DirectMessage(Guid Id,
    [property: JsonPropertyName("sender_id")] Guid SenderId,
    [property: JsonPropertyName("recipient_id")] Guid RecipientId,
    string Content,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);
internal sealed record UserProfile([property: JsonPropertyName("display_name")] string DisplayName, [property: JsonPropertyName("status_text")] string StatusText);
internal sealed record BetaTheme(
    [property: JsonPropertyName("theme")] string Theme,
    [property: JsonPropertyName("accent")] string Accent,
    [property: JsonPropertyName("sync_enabled")] bool SyncEnabled,
    [property: JsonPropertyName("last_server_id")] Guid? LastServerId,
    [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt);
internal sealed record Session(string AccessToken, string RefreshToken, Guid UserId, string Email, DateTimeOffset ExpiresAt);

internal sealed partial class Supabase : IDisposable
{
    // A publishable key is intended for public clients. Never put a service-role key here.
    private const string Url = "https://wfqudstuncdldsvxqveu.supabase.co/";
    private const string Key = "sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar";
    private readonly HttpClient http = new() { BaseAddress = new Uri(Url), Timeout = TimeSpan.FromSeconds(20) };
    private readonly SemaphoreSlim refreshLock = new(1, 1);
    private Session? session;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Session? Current => session;
    public event Action<string>? RefreshTokenChanged;
    public Supabase() => http.DefaultRequestHeaders.Add("apikey", Key);

    private static async Task<string> GetText(HttpResponseMessage response)
    {
        var value = await response.Content.ReadAsStringAsync();
        if (response.IsSuccessStatusCode) return value;
        try {
            using var json = JsonDocument.Parse(value);
            if (json.RootElement.TryGetProperty("msg", out var m) && m.ValueKind == JsonValueKind.String)
                value = m.GetString() ?? value;
            else if (json.RootElement.TryGetProperty("message", out m) && m.ValueKind == JsonValueKind.String)
                value = m.GetString() ?? value;
            else if (json.RootElement.TryGetProperty("error_description", out m) && m.ValueKind == JsonValueKind.String)
                value = m.GetString() ?? value;
            else if (json.RootElement.TryGetProperty("error", out m) && m.ValueKind == JsonValueKind.String)
                value = m.GetString() ?? value;
        } catch { }
        throw new HttpRequestException($"Request failed ({(int)response.StatusCode}): {value[..Math.Min(230, value.Length)]}", null, response.StatusCode);
    }

    private static Session ParseSession(string payload, string fallbackEmail)
    {
        using var json = JsonDocument.Parse(payload);
        var root = json.RootElement;
        if (!root.TryGetProperty("access_token", out var token))
            throw new InvalidOperationException("Account confirmation may be required. Check your email, then sign in.");
        var user = root.GetProperty("user");
        var id = Guid.Parse(user.GetProperty("id").GetString()!);
        var email = user.TryGetProperty("email", out var e) ? e.GetString() ?? fallbackEmail : fallbackEmail;
        var refresh = root.GetProperty("refresh_token").GetString()!;
        var expires = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600;
        return new Session(token.GetString()!, refresh, id, email, DateTimeOffset.UtcNow.AddSeconds(expires));
    }

    private const string UsernameAuthSuffix = "@users.zuzucord.invalid";
    private const string UsernameDisplaySuffix = "@zuzucord.com";

    public static string VisibleIdentity(string email)
    {
        return email.EndsWith(UsernameAuthSuffix, StringComparison.OrdinalIgnoreCase)
            ? email[..^UsernameAuthSuffix.Length] + UsernameDisplaySuffix
            : email;
    }

    public static string LoginEmail(string usernameOrEmail)
    {
        var input = usernameOrEmail.Trim().ToLowerInvariant();
        var username = input.EndsWith(UsernameDisplaySuffix, StringComparison.Ordinal)
            ? input[..^UsernameDisplaySuffix.Length]
            : input;
        if (System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-z0-9_]{3,24}$"))
            return username + UsernameAuthSuffix;
        if (input.Contains('@') && !input.EndsWith(UsernameDisplaySuffix, StringComparison.Ordinal))
            return input; // Existing verified email-account sign-in.
        throw new InvalidOperationException("Enter your username, username@zuzucord.com, or a valid account email.");
    }

    public async Task SignInAsync(string usernameOrEmail, string password)
    {
        var email = LoginEmail(usernameOrEmail);
        using var response = await http.PostAsJsonAsync("auth/v1/token?grant_type=password", new { email, password });
        session = ParseSession(await GetText(response), email);
        await EnsureAccountAsync();
        RefreshTokenChanged?.Invoke(session.RefreshToken);
    }

    public async Task RegisterUsernameAsync(string username, string password)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-z0-9_]{3,24}$"))
            throw new InvalidOperationException("Username must be 3–24 lowercase letters, numbers or underscores.");
        using var request = new HttpRequestMessage(HttpMethod.Post, "functions/v1/zuzucord-register");
        request.Content = JsonContent.Create(new { username, password });
        using var response = await http.SendAsync(request);
        await GetText(response);
    }

    private async Task EnsureAccountAsync()
    {
        if (session is null) return;
        using var request = new HttpRequestMessage(HttpMethod.Post, "rest/v1/zuzucord_accounts?on_conflict=user_id");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        request.Headers.TryAddWithoutValidation("Prefer", "resolution=ignore-duplicates,return=minimal");
        var username = session.Email.EndsWith("@users.zuzucord.invalid", StringComparison.OrdinalIgnoreCase)
            ? session.Email.Split('@')[0]
            : "member_" + session.UserId.ToString("N")[..16];
        request.Content = JsonContent.Create(new { user_id = session.UserId, username });
        using var response = await http.SendAsync(request);
        await GetText(response);
    }

    public async Task SignUpAsync(string email, string password)
    {
        using var response = await http.PostAsJsonAsync("auth/v1/signup", new { email, password });
        var data = await GetText(response);
        try { session = ParseSession(data, email); if (session is not null) { await EnsureAccountAsync(); RefreshTokenChanged?.Invoke(session.RefreshToken); } }
        catch (InvalidOperationException) { session = null; }
    }

    public async Task RestoreAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) throw new InvalidOperationException("No stored login session.");
        using var response = await http.PostAsJsonAsync("auth/v1/token?grant_type=refresh_token", new { refresh_token = token });
        session = ParseSession(await GetText(response), "");
        await EnsureAccountAsync();
        RefreshTokenChanged?.Invoke(session.RefreshToken);
    }

    public void SignOut()
    {
        session = null;
        LoginVault.Clear();
    }

    private async Task EnsureFresh()
    {
        if (session is null) throw new InvalidOperationException("Sign in first.");
        if (session.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2)) return;
        await refreshLock.WaitAsync();
        try
        {
            if (session is null) throw new InvalidOperationException("Sign in again.");
            if (session.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2)) return;
            using var response = await http.PostAsJsonAsync("auth/v1/token?grant_type=refresh_token", new { refresh_token = session.RefreshToken });
            session = ParseSession(await GetText(response), session.Email);
            RefreshTokenChanged?.Invoke(session.RefreshToken);
        }
        finally { refreshLock.Release(); }
    }

    private async Task<string> Api(HttpMethod method, string path, object? body = null, string? prefer = null)
    {
        await EnsureFresh();
        using var request = new HttpRequestMessage(method, "rest/v1/" + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session!.AccessToken);
        if(prefer is not null) request.Headers.TryAddWithoutValidation("Prefer", prefer);
        if (body is not null) request.Content = JsonContent.Create(body);
        using var response = await http.SendAsync(request);
        return await GetText(response);
    }

    public async Task<List<Room>> RoomsAsync()
    {
        var data = await Api(HttpMethod.Get, "zuzucord_rooms?select=id,name,description&is_public=eq.true&order=name.asc");
        return JsonSerializer.Deserialize<List<Room>>(data, Json) ?? [];
    }

    public async Task<List<ChatMessage>> MessagesAsync(Guid roomId)
    {
        var path = $"zuzucord_messages?select=id,author_id,content,created_at&room_id=eq.{roomId}&order=created_at.desc&limit=70";
        var data = await Api(HttpMethod.Get, path);
        var messages = JsonSerializer.Deserialize<List<ChatMessage>>(data, Json) ?? [];
        messages.Reverse();
        return messages;
    }

    public async Task SendAsync(Guid roomId, string message)
    {
        if (session is null) throw new InvalidOperationException("Sign in first.");
        if (string.IsNullOrWhiteSpace(message) || message.Length > 2000) throw new InvalidOperationException("Messages must contain 1 to 2000 characters.");
        await Api(HttpMethod.Post, "zuzucord_messages", new { room_id = roomId, author_id = session.UserId, content = message.Trim() });
    }

    public async Task<UserProfile> GetProfileAsync()
    {
        if(session is null) throw new InvalidOperationException("Sign in first.");
        var value = await Api(HttpMethod.Get, "zuzucord_profiles?select=display_name,status_text&user_id=eq." + session.UserId);
        var items = JsonSerializer.Deserialize<List<UserProfile>>(value, Json);
        return items is { Count: > 0 } ? items[0] : new UserProfile("", "");
    }

    public async Task SaveProfileAsync(string displayName, string statusText)
    {
        if (session is null) throw new InvalidOperationException("Sign in first.");
        displayName = displayName.Trim();
        statusText = statusText.Trim();
        if(displayName.Length > 40 || statusText.Length > 120) throw new InvalidOperationException("Profile is too long.");
        await Api(HttpMethod.Post, "zuzucord_profiles?on_conflict=user_id",
            new { user_id = session.UserId, display_name = displayName, status_text = statusText },
            "resolution=merge-duplicates,return=minimal");
    }

    public async Task<DirectoryResult?> FindUsernameAsync(string username)
    {
        var data = await Api(HttpMethod.Post, "rpc/zuzucord_find_username", new { p_username = username.ToLowerInvariant().Trim() });
        return JsonSerializer.Deserialize<List<DirectoryResult>>(data, Json)?.FirstOrDefault();
    }

    public async Task<string> FriendUsernameAsync(Guid id)
    {
        var data = await Api(HttpMethod.Post, "rpc/zuzucord_friend_username", new { p_target = id });
        return JsonSerializer.Deserialize<string?>(data, Json) ?? id.ToString("N")[..8];
    }

    public async Task<List<FriendRequest>> FriendsAsync()
    {
        if (session is null) throw new InvalidOperationException("Sign in first.");
        var data = await Api(HttpMethod.Get,
            "zuzucord_friend_requests?select=id,from_user,to_user,status&or=(from_user.eq." + session.UserId +
            ",to_user.eq." + session.UserId + ")&order=created_at.desc");
        return JsonSerializer.Deserialize<List<FriendRequest>>(data, Json) ?? [];
    }

    public async Task SendFriendRequestAsync(string username)
    {
        var found = await FindUsernameAsync(username);
        if(found is null) throw new InvalidOperationException("No matching ZuzuCord username was found.");
        if (session is null || found.UserId == session.UserId) throw new InvalidOperationException("You cannot friend yourself.");
        await Api(HttpMethod.Post,"zuzucord_friend_requests",
            new { from_user=session.UserId,to_user=found.UserId,status="pending" });
    }

    public async Task RespondFriendAsync(Guid requestId, bool accept)
    {
        if(session is null) throw new InvalidOperationException("Sign in first.");
        await Api(new HttpMethod("PATCH"),
            "zuzucord_friend_requests?id=eq." + requestId + "&to_user=eq." + session.UserId + "&status=eq.pending",
            new { status=accept ? "accepted" : "declined" }, "return=minimal");
    }

    public async Task<List<DirectMessage>> DirectMessagesAsync(Guid friendId)
    {
        if(session is null) throw new InvalidOperationException("Sign in first.");
        var me=session.UserId;
        var path="zuzucord_direct_messages?select=id,sender_id,recipient_id,content,created_at&or=(and(sender_id.eq." +
            me + ",recipient_id.eq." + friendId + "),and(sender_id.eq." + friendId +
            ",recipient_id.eq." + me + "))&order=created_at.desc&limit=80";
        var data=await Api(HttpMethod.Get,path);
        var messages=JsonSerializer.Deserialize<List<DirectMessage>>(data,Json) ?? [];
        messages.Reverse();
        return messages;
    }

    public async Task SendDirectMessageAsync(Guid friendId, string content)
    {
        if(session is null) throw new InvalidOperationException("Sign in first.");
        if(string.IsNullOrWhiteSpace(content) || content.Length>2000)
            throw new InvalidOperationException("Messages must be 1 to 2000 characters.");
        await Api(HttpMethod.Post,"zuzucord_direct_messages",
            new {sender_id=session.UserId,recipient_id=friendId,content=content.Trim()});
    }

    public async Task<bool> IsBetaTesterAsync()
    {
        var result = await Api(HttpMethod.Post, "rpc/zuzucord_is_beta_tester", new { });
        return bool.TryParse(result.Trim(), out var active) && active;
    }

    public async Task<BetaTheme?> ReadBetaThemeAsync()
    {
        if (session is null) return null;
        var response = await Api(HttpMethod.Get, "zuzucord_beta_sync?select=theme,accent,sync_enabled,last_server_id,updated_at&user_id=eq." + session.UserId);
        return JsonSerializer.Deserialize<List<BetaTheme>>(response, Json)?.FirstOrDefault();
    }

    public async Task SaveBetaThemeAsync(string theme, string accent, bool enabled)
    {
        if (session is null) throw new InvalidOperationException("Sign in first.");
        if (!await IsBetaTesterAsync()) throw new UnauthorizedAccessException("Beta theme sync is restricted to approved testers.");
        var data = new {
            user_id = session.UserId,
            theme = ThemeColors.NormalizeTheme(theme),
            accent = ThemeColors.NormalizeAccent(accent),
            sync_enabled = enabled,
            updated_at = DateTimeOffset.UtcNow
        };
        await Api(HttpMethod.Post, "zuzucord_beta_sync?on_conflict=user_id", data, "resolution=merge-duplicates,return=minimal");
    }

    public async Task SaveBetaSelectedServerAsync(Guid? serverId)
    {
        if (session is null) throw new InvalidOperationException("Sign in first.");
        if (!await IsBetaTesterAsync()) return;
        var current = await ReadBetaThemeAsync();
        if (current is null || !current.SyncEnabled) return;
        await Api(new HttpMethod("PATCH"),
            "zuzucord_beta_sync?user_id=eq." + session.UserId,
            new { last_server_id = serverId, updated_at = DateTimeOffset.UtcNow },
            "return=minimal");
    }

    public void Dispose()
    {
        session = null;
        refreshLock.Dispose();
        http.Dispose();
    }
}
