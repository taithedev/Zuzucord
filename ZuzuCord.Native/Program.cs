using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord.Native;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        using var warning = new NoticeForm();
        if (warning.ShowDialog() != DialogResult.OK) return;
        Application.Run(new ClientForm());
    }
}

internal sealed class NoticeForm : Form
{
    public NoticeForm()
    {
        Text = "ZuzuCord — Important warning";
        Size = new Size(700, 580);
        MinimumSize = new Size(580, 520);
        BackColor = Color.FromArgb(14, 14, 17);
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 10);
        StartPosition = FormStartPosition.CenterScreen;
        var body = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(32), RowCount = 4, ColumnCount = 1 };
        body.RowStyles.Add(new RowStyle(SizeType.Absolute, 65));
        body.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        body.RowStyles.Add(new RowStyle(SizeType.Absolute, 65));
        body.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        var title = new Label { Text = "ZuzuCord — Before you continue", Font = new Font("Segoe UI Semibold", 18), Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
        var text = new Label {
            Dock = DockStyle.Fill, AutoSize = false, ForeColor = Color.Gainsboro,
            Text = "IMPORTANT — ACCOUNT RESTRICTIONS AND BANS\n\n" +
                   "ZuzuCord is an unofficial third-party application. It is not endorsed, sponsored, or supported by Discord.\n\n" +
                   "Using unsupported third-party software may violate Discord policies. Your account could be restricted, suspended, or banned. " +
                   "The ZuzuCord developers cannot prevent or reverse Discord enforcement decisions and are not responsible for those decisions to the extent permitted by law.\n\n" +
                   "You are responsible for following Discord's Terms of Service and Community Guidelines. " +
                   "This notice does not waive any statutory rights or excuse negligence or unlawful conduct.\n\n" +
                   "This native build uses the official Discord bot API. It is not a full user-account Discord client. " +
                   "Never enter your personal Discord user token here."
        };
        var consent = new CheckBox { Text = "I understand the risks and want to proceed.", Dock = DockStyle.Fill, ForeColor = Color.White };
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        var accept = new Button { Text = "Agree and Open", Width = 150, Height = 40, Enabled = false, BackColor = Color.White, ForeColor = Color.Black, FlatStyle = FlatStyle.Flat };
        var exit = new Button { Text = "Exit", Width = 100, Height = 40, BackColor = Color.FromArgb(36, 36, 42), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
        consent.CheckedChanged += (_, _) => accept.Enabled = consent.Checked;
        accept.Click += (_, _) => { DialogResult = DialogResult.OK; Close(); };
        exit.Click += (_, _) => { DialogResult = DialogResult.Cancel; Close(); };
        actions.Controls.Add(accept);
        actions.Controls.Add(exit);
        body.Controls.Add(title, 0, 0);
        body.Controls.Add(text, 0, 1);
        body.Controls.Add(consent, 0, 2);
        body.Controls.Add(actions, 0, 3);
        Controls.Add(body);
        AcceptButton = accept;
        CancelButton = exit;
    }
}

internal sealed class ClientForm : Form
{
    private readonly HttpClient http = new() { BaseAddress = new Uri("https://discord.com/api/v10/"), Timeout = TimeSpan.FromSeconds(20) };
    private readonly ListBox servers = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(28, 28, 34), ForeColor = Color.White, BorderStyle = BorderStyle.None };
    private readonly ListBox channels = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(37, 37, 45), ForeColor = Color.White, BorderStyle = BorderStyle.None };
    private readonly RichTextBox messages = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(20, 20, 26), ForeColor = Color.White, ReadOnly = true, BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 10), Padding = new Padding(10) };
    private readonly TextBox draft = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(39, 39, 47), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle, PlaceholderText = "Message as bot…" };
    private readonly TextBox token = new() { Width = 290, UseSystemPasswordChar = true, PlaceholderText = "Discord bot token (not a user token)", BackColor = Color.FromArgb(42, 42, 50), ForeColor = Color.White };
    private readonly Label status = new() { AutoSize = true, ForeColor = Color.Gainsboro, Text = "Not connected" };
    private readonly Button connect = MakeButton("Connect bot", 110);
    private readonly Button refresh = MakeButton("Refresh", 80);
    private readonly Button send = MakeButton("Send", 80);
    private readonly List<(string id, string name)> guildItems = new();
    private readonly List<(string id, string name)> channelItems = new();
    private bool busy;

    public ClientForm()
    {
        Text = "ZuzuCord Native — Discord Bot Channels";
        Size = new Size(1250, 820);
        MinimumSize = new Size(850, 520);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(16, 16, 20);
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 10);

        var header = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 62, Padding = new Padding(12, 10, 4, 0), BackColor = Color.FromArgb(15, 15, 18) };
        header.Controls.Add(new Label { Text = "ZuzuCord", Width = 110, Height = 34, Font = new Font("Segoe UI Semibold", 15), ForeColor = Color.White });
        header.Controls.Add(token);
        header.Controls.Add(connect);
        header.Controls.Add(refresh);
        header.Controls.Add(status);

        var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3 };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 180));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 230));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        root.Controls.Add(servers, 0, 0);
        root.Controls.Add(channels, 1, 0);
        var chat = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 2 };
        chat.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        chat.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        chat.Controls.Add(messages, 0, 0);
        var compose = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(6) };
        compose.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        compose.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 90));
        compose.Controls.Add(draft, 0, 0);
        compose.Controls.Add(send, 1, 0);
        chat.Controls.Add(compose, 0, 1);
        root.Controls.Add(chat, 2, 0);
        Controls.Add(root);
        Controls.Add(header);

        servers.SelectedIndexChanged += async (_, _) => await LoadChannels();
        channels.SelectedIndexChanged += async (_, _) => await LoadMessages();
        connect.Click += async (_, _) => await Connect();
        refresh.Click += async (_, _) => await Refresh();
        send.Click += async (_, _) => await Send();
        draft.KeyDown += async (_, e) => { if (e.KeyCode == Keys.Enter && !e.Shift) { e.SuppressKeyPress = true; await Send(); } };
        messages.Text = "Native Windows interface. Connect a Discord bot that you control to view servers, channels, and messages it has access to.\n\nA bot token is required. Never use a personal account token.";
    }

    private static Button MakeButton(string text, int width) => new() { Text = text, Width = width, Height = 34, BackColor = Color.FromArgb(49, 49, 58), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };

    private async Task<JsonDocument> Call(HttpMethod method, string endpoint, object? payload = null)
    {
        using var req = new HttpRequestMessage(method, endpoint);
        if (payload is not null) req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(req);
        var data = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Discord API {(int)response.StatusCode}: {data[..Math.Min(200, data.Length)]}");
        return JsonDocument.Parse(string.IsNullOrWhiteSpace(data) ? "{}" : data);
    }

    private async Task Connect()
    {
        if (busy || string.IsNullOrWhiteSpace(token.Text)) return;
        busy = true;
        connect.Enabled = false;
        try
        {
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bot", token.Text.Trim());
            using var me = await Call(HttpMethod.Get, "users/@me");
            status.Text = "Connected: " + me.RootElement.GetProperty("username").GetString();
            token.Clear();
            await LoadGuilds();
        }
        catch (Exception ex) { ShowError(ex); http.DefaultRequestHeaders.Authorization = null; }
        finally { busy = false; connect.Enabled = true; }
    }

    private async Task Refresh()
    {
        if (http.DefaultRequestHeaders.Authorization is null) return;
        if (channels.SelectedIndex >= 0) await LoadMessages();
        else if (servers.SelectedIndex >= 0) await LoadChannels();
        else await LoadGuilds();
    }

    private async Task LoadGuilds()
    {
        try
        {
            using var response = await Call(HttpMethod.Get, "users/@me/guilds?limit=200");
            guildItems.Clear();
            servers.Items.Clear();
            foreach (var item in response.RootElement.EnumerateArray())
            {
                var id = item.GetProperty("id").GetString()!;
                var name = item.GetProperty("name").GetString()!;
                guildItems.Add((id, name));
                servers.Items.Add(name);
            }
            status.Text = $"Connected · {guildItems.Count} servers";
        }
        catch (Exception ex) { ShowError(ex); }
    }

    private async Task LoadChannels()
    {
        var index = servers.SelectedIndex;
        if (index < 0 || index >= guildItems.Count) return;
        var guildId = guildItems[index].id;
        channels.Items.Clear();
        channelItems.Clear();
        messages.Clear();
        try
        {
            using var response = await Call(HttpMethod.Get, $"guilds/{guildId}/channels");
            foreach (var item in response.RootElement.EnumerateArray())
            {
                var type = item.GetProperty("type").GetInt32();
                if (type != 0 && type != 5) continue;
                var id = item.GetProperty("id").GetString()!;
                var name = item.GetProperty("name").GetString() ?? "channel";
                channelItems.Add((id, name));
                channels.Items.Add("# " + name);
            }
        }
        catch (Exception ex) { ShowError(ex); }
    }

    private async Task LoadMessages()
    {
        var index = channels.SelectedIndex;
        if (index < 0 || index >= channelItems.Count) return;
        var channelId = channelItems[index].id;
        messages.Text = "Loading messages…";
        try
        {
            using var response = await Call(HttpMethod.Get, $"channels/{channelId}/messages?limit=50");
            var list = response.RootElement.EnumerateArray().ToList();
            list.Reverse();
            var sb = new StringBuilder();
            foreach (var item in list)
            {
                var author = item.GetProperty("author").GetProperty("username").GetString();
                var content = item.GetProperty("content").GetString();
                var date = item.GetProperty("timestamp").GetString();
                sb.AppendLine($"[{date}] {author}: {content}");
                sb.AppendLine();
            }
            messages.Text = sb.Length > 0 ? sb.ToString() : "No readable messages.";
            messages.SelectionStart = messages.TextLength;
            messages.ScrollToCaret();
        }
        catch (Exception ex) { ShowError(ex); }
    }

    private async Task Send()
    {
        var index = channels.SelectedIndex;
        var content = draft.Text.Trim();
        if (index < 0 || index >= channelItems.Count || content.Length == 0 || content.Length > 2000) return;
        send.Enabled = false;
        try
        {
            await Call(HttpMethod.Post, $"channels/{channelItems[index].id}/messages", new { content });
            draft.Clear();
            await LoadMessages();
        }
        catch (Exception ex) { ShowError(ex); }
        finally { send.Enabled = true; }
    }

    private void ShowError(Exception ex)
    {
        status.Text = "Error";
        MessageBox.Show(this, ex.Message, "ZuzuCord — Request error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) http.Dispose();
        base.Dispose(disposing);
    }
}
