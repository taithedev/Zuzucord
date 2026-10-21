using System.Text.Json;
using System.Text.Json.Serialization;

namespace ZuzuCord;

internal sealed record ZuzuServer(
    Guid Id, string Name, string Description,
    [property: JsonPropertyName("owner_id")] Guid OwnerId);

internal sealed record ServerChannel(
    Guid Id, [property: JsonPropertyName("server_id")] Guid ServerId,
    string Name, string Description);

internal sealed partial class Supabase
{
    public async Task<List<ZuzuServer>> ServersAsync()
    {
        var data = await Api(HttpMethod.Get,
            "zuzucord_servers?select=id,name,description,owner_id&order=created_at.desc");
        return JsonSerializer.Deserialize<List<ZuzuServer>>(data, Json) ?? [];
    }

    public async Task<List<ServerChannel>> ServerChannelsAsync(Guid serverId)
    {
        var data = await Api(HttpMethod.Get,
            $"zuzucord_server_channels?select=id,server_id,name,description&server_id=eq.{serverId}&order=position.asc,created_at.asc");
        return JsonSerializer.Deserialize<List<ServerChannel>>(data, Json) ?? [];
    }

    public async Task<Guid> CreateServerAsync(string name, string description = "")
    {
        var data = await Api(HttpMethod.Post, "rpc/zuzucord_create_server",
            new { p_name = name.Trim(), p_description = description.Trim() });
        return JsonSerializer.Deserialize<Guid>(data, Json);
    }

    public async Task<Guid> JoinServerAsync(string code)
    {
        var data = await Api(HttpMethod.Post, "rpc/zuzucord_join_server",
            new { p_invite = code.Trim().ToLowerInvariant() });
        return JsonSerializer.Deserialize<Guid>(data, Json);
    }

    public async Task<Guid> CreateServerChannelAsync(Guid serverId, string name)
    {
        var data = await Api(HttpMethod.Post, "rpc/zuzucord_create_channel",
            new { p_server = serverId, p_name = name.Trim().ToLowerInvariant() });
        return JsonSerializer.Deserialize<Guid>(data, Json);
    }

    public async Task<string?> ServerInviteAsync(Guid serverId)
    {
        var data = await Api(HttpMethod.Post, "rpc/zuzucord_server_invite",
            new { p_server = serverId });
        return JsonSerializer.Deserialize<string?>(data, Json);
    }

    public async Task<List<ChatMessage>> ServerMessagesAsync(Guid channelId)
    {
        var data = await Api(HttpMethod.Get,
            $"zuzucord_server_messages?select=id,author_id,content,created_at&channel_id=eq.{channelId}&order=created_at.desc&limit=75");
        var list = JsonSerializer.Deserialize<List<ChatMessage>>(data, Json) ?? [];
        list.Reverse();
        return list;
    }

    public async Task SendServerMessageAsync(Guid channelId, string content)
    {
        if (session is null) throw new InvalidOperationException("Sign in first.");
        if (string.IsNullOrWhiteSpace(content) || content.Length > 2000)
            throw new InvalidOperationException("Messages must be 1–2000 characters.");
        await Api(HttpMethod.Post, "zuzucord_server_messages",
            new { channel_id = channelId, author_id = session.UserId, content = content.Trim() });
    }
}
