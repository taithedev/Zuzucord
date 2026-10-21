using System.Drawing;
using System.Text;
using System.Windows.Forms;

namespace ZuzuCord;

internal static class Program
{
    [STAThread] private static void Main()
    {
        ApplicationConfiguration.Initialize();
        var settings = UserSettings.Load();
        ThemeColors.Configure(settings.Theme, settings.Accent);
        using var notice = new NoticeForm();
        if (notice.ShowDialog() != DialogResult.OK) return;
        if (!settings.SetupCompleted)
        {
            using var setup = new SetupForm(settings);
            if (setup.ShowDialog() != DialogResult.OK) return;
        }
        using var api = new Supabase();
        api.RefreshTokenChanged += token =>
        {
            if (settings.RememberLogin)
            {
                try { LoginVault.Save(token); }
                catch { /* Login still works for this session without persistent storage. */ }
            }
            else LoginVault.Clear();
        };
        using var login = new LoginForm(api, settings);
        if (login.ShowDialog() != DialogResult.OK) return;
        Application.Run(new ChatWindow(api, settings));
    }
}

internal static class Ui
{
    public static Color Background => ThemeColors.Background;
    public static Color Panel => ThemeColors.Panel;
    public static Color Side => ThemeColors.Side;
    public static Color Secondary => ThemeColors.Muted;
    public static readonly Font Font = new("Segoe UI", 10);
    public static Button Button(string text, int width) => new ZuzuButton()
    {
        Text = text, Width = width, Height = 38, BackColor = ThemeColors.Panel,
        ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Margin = new Padding(4),
        Font = Font
    };
    public static TextBox Input(string placeholder) => new()
    {
        PlaceholderText = placeholder, Dock = DockStyle.Fill, Margin = new Padding(5),
        BackColor = ThemeColors.Input, ForeColor = Color.White,
        BorderStyle = BorderStyle.FixedSingle, Font = Font
    };
}

internal sealed class ChatWindow : Form
{
    private readonly Supabase api;
    private readonly UserSettings settings;
    private int updateTicks;
    private readonly ListBox servers = new() {
        Dock = DockStyle.Fill, BackColor = Ui.Background, ForeColor = Color.White,
        BorderStyle = BorderStyle.None, Font = new Font("Segoe UI Semibold", 10),
        IntegralHeight = false
    };
    private readonly List<ZuzuServer> serverItems = [];
    private readonly List<ServerChannel> channelItems = [];
    private Guid? selectedServer;
    private readonly Label serverTitle = new() {
        Dock = DockStyle.Fill, Text = "  CHANNELS", ForeColor = Ui.Secondary,
        TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI Semibold", 10)
    };
    private readonly Button createChannel = Ui.Button("+ Channel", 99);
    private readonly Button invite = Ui.Button("Invite", 80);
    private readonly ListBox rooms = new() { Dock = DockStyle.Fill, BackColor = Ui.Side, ForeColor = Color.White,
        BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 11),
        DrawMode = DrawMode.OwnerDrawFixed, ItemHeight = 40, IntegralHeight = false };
    private readonly RichTextBox transcript = new() { Dock = DockStyle.Fill, ReadOnly = true, BackColor = Ui.Background,
        ForeColor = Color.FromArgb(225, 225, 232), BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 11) };
    private readonly TextBox compose = Ui.Input("Message this channel…");
    private readonly Label status = new() { Dock = DockStyle.Fill, ForeColor = Ui.Secondary, TextAlign = ContentAlignment.MiddleLeft };
    private readonly Label channelName = new() { Dock = DockStyle.Fill, ForeColor = Color.White, Text = "# welcome",
        Font = new Font("Segoe UI Semibold", 12), TextAlign = ContentAlignment.MiddleLeft };
    private readonly Button send = Ui.Button("Send", 90);
    private readonly TextBox search = Ui.Input("Search recent messages...");
    private readonly List<ChatMessage> cachedMessages = [];
    private string lastRendered = "";
    private readonly Label account = new() { Dock=DockStyle.Fill, ForeColor=Ui.Secondary, TextAlign=ContentAlignment.MiddleLeft };
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 15000 };
    private readonly List<Room> roomItems = [];
    private bool loading, sending;
    private Guid? selectedRoom;
    private readonly SemaphoreSlim refreshGate = new(1, 1);

    public ChatWindow(Supabase client, UserSettings preferences)
    {
        api = client;
        settings = preferences;
        Text = "ZuzuCord V2 — Desktop"; Size = new Size(settings.WindowWidth, settings.WindowHeight); MinimumSize = new Size(850, 550);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Ui.Background; ForeColor = Color.White; Font = Ui.Font;

        var header = new TableLayoutPanel { Dock = DockStyle.Top, Height = 66, ColumnCount = 6,
            BackColor = Ui.Panel, Padding = new Padding(17, 10, 17, 8) };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 175));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 140));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 140));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 140));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 140));
        header.Controls.Add(new Label { Text = "ZuzuCord  /  V2", Dock = DockStyle.Fill,
            Font = new Font("Segoe UI Semibold", 16), ForeColor = Color.White, TextAlign = ContentAlignment.MiddleLeft }, 0, 0);
        header.Controls.Add(status, 1, 0);
        var reload = SiticoneShell.Action("Refresh", 118);
        header.Controls.Add(reload, 2, 0);
        var profile = SiticoneShell.Action("My profile", 120);
        header.Controls.Add(profile, 3, 0);
        profile.Click += (_, _) => { using var dialog = new ProfileForm(api); dialog.ShowDialog(this); };
        var friendsButton = SiticoneShell.Action("Friends / DMs", 125);
        header.Controls.Add(friendsButton, 4, 0);
        friendsButton.Click += (_, _) => { using var friendsDialog = new FriendsForm(api); friendsDialog.ShowDialog(this); };
        var appearance = SiticoneShell.Action("Appearance", 125);
        header.Controls.Add(appearance, 5, 0);
        appearance.Click += (_, _) =>
        {
            using var editorWindow = new AppearanceForm(api, settings);
            editorWindow.ShowDialog(this);
        };

        var shell = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3 };
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170));
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 245));
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        var serverRail = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, BackColor = Ui.Background };
        serverRail.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        serverRail.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        serverRail.RowStyles.Add(new RowStyle(SizeType.Absolute, 102));
        serverRail.Controls.Add(new Label {
            Text = "  SERVERS", Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted,
            Font = new Font("Segoe UI Semibold", 11), TextAlign = ContentAlignment.MiddleLeft
        }, 0, 0);
        serverRail.Controls.Add(servers, 0, 1);
        var serverActions = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(5) };
        var createServer = Ui.Button("+ Server", 140);
        var joinServer = Ui.Button("Join invite", 140);
        serverActions.Controls.Add(createServer);
        serverActions.Controls.Add(joinServer);
        serverRail.Controls.Add(serverActions, 0, 2);
        shell.Controls.Add(serverRail, 0, 0);
        createServer.Click += async (_, _) => await CreateServer();
        joinServer.Click += async (_, _) => await JoinServer();
        var sidebar = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, BackColor = Ui.Side };
        sidebar.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
        sidebar.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        sidebar.RowStyles.Add(new RowStyle(SizeType.Absolute, 65));
        var channelTop = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3 };
        channelTop.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        channelTop.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 102));
        channelTop.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 80));
        channelTop.Controls.Add(serverTitle, 0, 0);
        channelTop.Controls.Add(createChannel, 1, 0);
        channelTop.Controls.Add(invite, 2, 0);
        sidebar.Controls.Add(channelTop, 0, 0);
        createChannel.Enabled = invite.Enabled = false;
        createChannel.Click += async (_, _) => await CreateChannel();
        invite.Click += async (_, _) => await ShowInvite();
        sidebar.Controls.Add(rooms, 0, 1);
        var profileArea = new TableLayoutPanel { Dock=DockStyle.Fill, BackColor=Ui.Panel, ColumnCount=2 };
        profileArea.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        profileArea.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 42));
        var logout = Ui.Button("↪", 35);
        logout.AccessibleName = "Sign out";
        logout.Click += (_, _) => { api.SignOut(); Close(); };
        profileArea.Controls.Add(account, 0, 0);
        profileArea.Controls.Add(logout, 1, 0);
        sidebar.Controls.Add(profileArea, 0, 2);
        shell.Controls.Add(sidebar, 1, 0);

        var right = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1 };
        right.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
        right.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        right.RowStyles.Add(new RowStyle(SizeType.Absolute, 72));
        var channelHeader = new TableLayoutPanel { Dock=DockStyle.Fill, ColumnCount=2, BackColor=Ui.Panel, Padding=new Padding(12, 7, 12, 7) };
        channelHeader.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        channelHeader.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 255));
        channelHeader.Controls.Add(channelName, 0, 0);
        channelHeader.Controls.Add(search, 1, 0);
        right.Controls.Add(channelHeader, 0, 0);
        right.Controls.Add(transcript, 0, 1);
        var editor = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(8, 11, 8, 9) };
        editor.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        editor.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 100));
        editor.Controls.Add(compose, 0, 0); editor.Controls.Add(send, 1, 0);
        right.Controls.Add(editor, 0, 2);
        shell.Controls.Add(right, 2, 0);
        Controls.Add(shell); Controls.Add(header); Controls.Add(SiticoneShell.Accent());

        rooms.DrawItem += (_, e) =>
        {
            if (e.Index < 0 || e.Index >= rooms.Items.Count) return;
            bool active = (e.State & DrawItemState.Selected) != 0;
            using var brush = new SolidBrush(active ? ThemeColors.Panel : ThemeColors.Side);
            e.Graphics.FillRectangle(brush, e.Bounds);
            if (active)
            {
                using var accent = new SolidBrush(ThemeColors.Accent);
                e.Graphics.FillRectangle(accent, e.Bounds.X + 2, e.Bounds.Y + 6, 3, e.Bounds.Height - 12);
            }
            var bounds = new Rectangle(e.Bounds.X + 14, e.Bounds.Y, Math.Max(1, e.Bounds.Width - 20), e.Bounds.Height);
            TextRenderer.DrawText(e.Graphics, rooms.Items[e.Index]?.ToString() ?? "", rooms.Font,
                bounds, active ? Color.White : ThemeColors.Muted,
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        };
        servers.SelectedIndexChanged += async (_, _) => await SelectServer();
        rooms.SelectedIndexChanged += async (_, _) => await SelectRoom();
        send.Click += async (_, _) => await Send();
        compose.KeyDown += async (_, e) => { if (e.KeyCode == Keys.Enter && !e.Shift) { e.SuppressKeyPress = true; await Send(); } };
        reload.Click += async (_, _) => { await LoadServers(); await Refresh(); };
        search.TextChanged += (_, _) => RenderMessages();
        KeyPreview = true;
        KeyDown += (_,e)=> { if(e.Control && e.KeyCode==Keys.F){e.SuppressKeyPress=true;search.Focus();} };
        search.AccessibleName = "Search messages loaded in the current channel";
        timer.Tick += async (_, _) =>
        {
            await Refresh();
            if (++updateTicks % 4 == 0) await TryPullBetaThemeAsync();
        };
        Shown += async (_, _) =>
        {
            await LoadServers();
            await TryPullBetaThemeAsync();
            timer.Start();
        };
        FormClosed += (_, _) =>
        {
            timer.Stop();
            timer.Dispose();
            if (WindowState == FormWindowState.Normal)
            {
                settings.WindowWidth = Width;
                settings.WindowHeight = Height;
                try { settings.Save(); } catch { }
            }
        };
        status.Text = "ZUZUCORD  •  connected";
        var identity = Supabase.VisibleIdentity(api.Current?.Email ?? "member");
        account.Text = "  " + identity;
        account.AutoEllipsis = true;
        status.AutoEllipsis = true;
        transcript.Text = "Welcome to ZuzuCord V2.\n\nChoose a channel to join the conversation.";
    }

    private async Task TryPullBetaThemeAsync()
    {
        if (!settings.BetaSyncEnabled || api.Current is null) return;
        try
        {
            var theme = await api.ReadBetaThemeAsync();
            if (theme is null || !theme.SyncEnabled) return;
            var preset = ThemeColors.NormalizeTheme(theme.Theme);
            var accent = ThemeColors.NormalizeAccent(theme.Accent);
            if (preset == settings.Theme && accent == settings.Accent) return;
            settings.Theme = preset;
            settings.Accent = accent;
            settings.Save();
            ThemeColors.Configure(settings.Theme, settings.Accent);
            ThemeColors.ApplyToOpenForms();
            status.Text = "Beta theme synced from website";
        }
        catch (Exception error) { status.Text = "Beta sync unavailable: " + error.Message; }
    }

    private async Task LoadServers(Guid? selectId = null)
    {
        try
        {
            // Populate the server rail from authenticated membership-checked results.
            var list = await api.ServersAsync();
            var selectedId = selectId ?? selectedServer;
            serverItems.Clear(); serverItems.AddRange(list);
            servers.Items.Clear();
            servers.Items.Add("◉  Public");
            foreach (var server in serverItems) servers.Items.Add("▣  " + server.Name);
            var selectedIndex = selectedId is Guid wanted
                ? serverItems.FindIndex(s => s.Id == wanted) + 1 : 0;
            if (selectedIndex < 0 || selectedIndex >= servers.Items.Count) selectedIndex = 0;
            servers.SelectedIndex = selectedIndex;
            await SelectServer();
        }
        catch (Exception error) { Report(error); }
    }

    private async Task SelectServer()
    {
        if (servers.SelectedIndex < 0) return;
        selectedRoom = null;
        channelItems.Clear();
        cachedMessages.Clear();
        lastRendered = "";
        rooms.Items.Clear();
        var index = servers.SelectedIndex - 1;
        selectedServer = index < 0 || index >= serverItems.Count ? null : serverItems[index].Id;
        createChannel.Enabled = selectedServer.HasValue;
        invite.Enabled = index >= 0 && index < serverItems.Count
            && serverItems[index].OwnerId == api.Current?.UserId;
        if (selectedServer is Guid serverId)
        {
            serverTitle.Text = "  " + serverItems[index].Name;
            try
            {
                var channels = await api.ServerChannelsAsync(serverId);
                if (selectedServer != serverId) return;
                channelItems.AddRange(channels);
                foreach (var channel in channels) rooms.Items.Add("  #  " + channel.Name);
                status.Text = serverItems[index].Name + " · " + channels.Count + " channels";
            }
            catch (Exception error) { Report(error); }
        }
        else
        {
            serverTitle.Text = "  PUBLIC ROOMS";
            try
            {
                var list = await api.RoomsAsync();
                roomItems.Clear(); roomItems.AddRange(list);
                foreach (var room in list) rooms.Items.Add("  #  " + room.Name);
                status.Text = list.Count + " public channels";
            }
            catch (Exception error) { Report(error); }
        }
        if (rooms.Items.Count > 0) rooms.SelectedIndex = 0;
        else
        {
            channelName.Text = selectedServer.HasValue ? "  No channels yet" : "  Public rooms";
            transcript.Text = "No channels available. Server owners can create a text channel.";
        }
    }

    private async Task SelectRoom()
    {
        var index = rooms.SelectedIndex;
        if (index < 0) return;
        if (selectedServer is Guid)
        {
            if (index >= channelItems.Count) return;
            selectedRoom = channelItems[index].Id;
            channelName.Text = "  #  " + channelItems[index].Name + "     " + channelItems[index].Description;
        }
        else
        {
            if (index >= roomItems.Count) return;
            selectedRoom = roomItems[index].Id;
            channelName.Text = "  #  " + roomItems[index].Name + "     " + roomItems[index].Description;
        }
        cachedMessages.Clear();
        lastRendered = "";
        transcript.Text = "Loading messages…";
        await Refresh();
    }

    private async Task CreateServer()
    {
        using var prompt = new ServerPrompt("Create a server", "Choose a name for your community. You'll own this server and its #general channel.", "Community name");
        if (prompt.ShowDialog(this) != DialogResult.OK) return;
        try
        {
            var created = await api.CreateServerAsync(prompt.Value);
            await LoadServers(created);
            status.Text = "Server created. Use Invite to share the code.";
        }
        catch (Exception error) { Report(error); }
    }

    private async Task JoinServer()
    {
        using var prompt = new ServerPrompt("Join a server", "Enter the 16-character invitation code from a server owner.", "Invitation code", 16);
        if (prompt.ShowDialog(this) != DialogResult.OK) return;
        try
        {
            var joined = await api.JoinServerAsync(prompt.Value);
            await LoadServers(joined);
            status.Text = "Joined server successfully.";
        }
        catch (Exception error) { Report(error); }
    }

    private async Task CreateChannel()
    {
        if (selectedServer is not Guid serverId) return;
        using var prompt = new ServerPrompt("Create a text channel", "Owners and admins can add channels. Use 2–32 lowercase letters, numbers, hyphens or underscores.", "new-channel", 32);
        if (prompt.ShowDialog(this) != DialogResult.OK) return;
        try
        {
            await api.CreateServerChannelAsync(serverId, prompt.Value);
            await SelectServer();
            status.Text = "Channel created.";
        }
        catch (Exception error) { Report(error); }
    }

    private async Task ShowInvite()
    {
        if (selectedServer is not Guid serverId) return;
        try
        {
            var code = await api.ServerInviteAsync(serverId);
            if (string.IsNullOrWhiteSpace(code)) throw new UnauthorizedAccessException("Only the server owner can view the invitation code.");
            if (MessageBox.Show(this, "Invitation code: " + code + "\n\nCopy to clipboard?",
                "Invite to ZuzuCord", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                Clipboard.SetText(code);
        }
        catch (Exception error) { Report(error); }
    }

    private async Task Refresh()
    {
        if (selectedRoom is not Guid room || loading) return;
        if (!await refreshGate.WaitAsync(0)) return;
        loading = true;
        try
        {
            var server = selectedServer;
            var list = server.HasValue
                ? await api.ServerMessagesAsync(room)
                : await api.MessagesAsync(room);
            if (selectedRoom != room || selectedServer != server) return;
            cachedMessages.Clear();
            cachedMessages.AddRange(list);
            RenderMessages();
        }
        catch (Exception e) { Report(e); }
        finally { loading = false; refreshGate.Release(); }
    }

    private void RenderMessages()
    {
        var needle = search.Text.Trim();
        var sb = new StringBuilder();
        foreach (var entry in cachedMessages)
        {
            var author = entry.AuthorId == api.Current?.UserId ? "You" : $"Member {entry.AuthorId.ToString("N")[..7]}";
            if (needle.Length > 0 && !entry.Content.Contains(needle, StringComparison.OrdinalIgnoreCase) &&
                !author.Contains(needle, StringComparison.OrdinalIgnoreCase)) continue;
            sb.AppendLine($"[{entry.CreatedAt.ToLocalTime():MMM d, HH:mm}] {author}");
            sb.AppendLine(entry.Content); sb.AppendLine();
        }
        var next = sb.Length > 0 ? sb.ToString() : needle.Length > 0 ? "No recent messages match your search." : "No messages yet. Start the conversation.";
        if (next == lastRendered) return;
        lastRendered = next;
        transcript.Clear();
        if (sb.Length == 0)
        {
            transcript.Text = next;
            return;
        }
        using var emphasis = new Font(transcript.Font, FontStyle.Bold);
        foreach (var entry in cachedMessages)
        {
            var author = entry.AuthorId == api.Current?.UserId ? "You" : $"Member {entry.AuthorId.ToString("N")[..7]}";
            if (needle.Length > 0 && !entry.Content.Contains(needle, StringComparison.OrdinalIgnoreCase) &&
                !author.Contains(needle, StringComparison.OrdinalIgnoreCase)) continue;
            transcript.SelectionStart = transcript.TextLength;
            transcript.SelectionFont = emphasis;
            transcript.SelectionColor = ThemeColors.Accent;
            transcript.AppendText(author);
            transcript.SelectionFont = transcript.Font;
            transcript.SelectionColor = ThemeColors.Muted;
            transcript.AppendText($"   {entry.CreatedAt.ToLocalTime():MMM d, HH:mm}\n");
            transcript.SelectionColor = Color.FromArgb(233, 233, 239);
            transcript.AppendText(entry.Content + "\n\n");
        }
        transcript.SelectionStart = transcript.TextLength;
        transcript.ScrollToCaret();
    }

    private async Task Send()
    {
        if (sending || selectedRoom is not Guid room) return;
        var content = compose.Text.Trim();
        if (content.Length is < 1 or > 2000) { status.Text = "Message length must be 1–2000 characters."; return; }
        sending = true; send.Enabled = false;
        try
        {
            if (selectedServer.HasValue) await api.SendServerMessageAsync(room, content);
            else await api.SendAsync(room, content);
            compose.Clear();
            await Refresh();
        }
        catch (Exception e) { Report(e); }
        finally { sending = false; send.Enabled = true; }
    }

    private void Report(Exception error)
    {
        status.Text = "Unable to sync: " + error.Message;
    }
}
