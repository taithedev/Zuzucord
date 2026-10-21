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
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);
internal sealed record UserProfile([property: JsonPropertyName("display_name")] string DisplayName, [property: JsonPropertyName("status_text")] string StatusText);
internal sealed record Session(string AccessToken, string RefreshToken, Guid UserId, string Email, DateTimeOffset ExpiresAt);

internal sealed class Supabase : IDisposable
{
    // A publishable key is intended for public clients. Never put a service-role key here.
    private const string Url = "https://wfqudstuncdldsvxqveu.supabase.co/";
    private const string Key = "sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar";
    private readonly HttpClient http = new() { BaseAddress = new Uri(Url), Timeout = TimeSpan.FromSeconds(20) };
    private readonly SemaphoreSlim refreshLock = new(1, 1);
    private Session? session;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Session? Current => session;
    public Supabase() => http.DefaultRequestHeaders.Add("apikey", Key);

    private static async Task<string> GetText(HttpResponseMessage response)
    {
        var value = await response.Content.ReadAsStringAsync();
        if (response.IsSuccessStatusCode) return value;
        try {
            using var json = JsonDocument.Parse(value);
            if (json.RootElement.TryGetProperty("msg", out var m)) value = m.GetString() ?? value;
            else if (json.RootElement.TryGetProperty("message", out m)) value = m.GetString() ?? value;
            else if (json.RootElement.TryGetProperty("error_description", out m)) value = m.GetString() ?? value;
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

    public static string LoginEmail(string usernameOrEmail)
    {
        var input = usernameOrEmail.Trim().ToLowerInvariant();
        return input.Contains('@') ? input : System.Text.RegularExpressions.Regex.IsMatch(input, "^[a-z0-9_]{3,24}$")
            ? input + "@users.zuzucord.invalid"
            : throw new InvalidOperationException("Enter a valid username (3–24 characters) or email.");
    }

    public async Task SignInAsync(string usernameOrEmail, string password)
    {
        var email = LoginEmail(usernameOrEmail);
        using var response = await http.PostAsJsonAsync("auth/v1/token?grant_type=password", new { email, password });
        session = ParseSession(await GetText(response), email);
        await EnsureAccountAsync();
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
        try { session = ParseSession(data, email); if (session is not null) await EnsureAccountAsync(); }
        catch (InvalidOperationException) { session = null; }
    }

    public void SignOut()
    {
        // No session tokens are written to disk. Closing the application discards them.
        session = null;
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

    public void Dispose()
    {
        session = null;
        refreshLock.Dispose();
        http.Dispose();
    }
}
