using System.Drawing;
using System.Text;
using System.Windows.Forms;

namespace ZuzuCord;

internal static class Program
{
    [STAThread] private static void Main()
    {
        ApplicationConfiguration.Initialize();
        using var notice = new NoticeForm();
        if (notice.ShowDialog() != DialogResult.OK) return;
        using var api = new Supabase();
        using var login = new LoginForm(api);
        if (login.ShowDialog() != DialogResult.OK) return;
        Application.Run(new ChatWindow(api));
    }
}

internal static class Ui
{
    public static readonly Color Background = Color.FromArgb(0, 0, 0);
    public static readonly Color Panel = Color.FromArgb(13, 13, 15);
    public static readonly Color Side = Color.FromArgb(9, 9, 11);
    public static readonly Color Secondary = Color.FromArgb(173, 173, 181);
    public static readonly Font Font = new("Segoe UI", 10);
    public static Button Button(string text, int width) => new()
    {
        Text = text, Width = width, Height = 38, BackColor = Color.FromArgb(32, 32, 38),
        ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Margin = new Padding(4),
        Font = Font
    };
    public static TextBox Input(string placeholder) => new()
    {
        PlaceholderText = placeholder, Dock = DockStyle.Fill, Margin = new Padding(5),
        BackColor = Color.FromArgb(22, 22, 26), ForeColor = Color.White,
        BorderStyle = BorderStyle.FixedSingle, Font = Font
    };
}

internal sealed class ChatWindow : Form
{
    private readonly Supabase api;
    private readonly ListBox rooms = new() { Dock = DockStyle.Fill, BackColor = Ui.Side, ForeColor = Color.White,
        BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 11), IntegralHeight = false };
    private readonly RichTextBox transcript = new() { Dock = DockStyle.Fill, ReadOnly = true, BackColor = Ui.Background,
        ForeColor = Color.FromArgb(225, 225, 232), BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 11) };
    private readonly TextBox compose = Ui.Input("Message this channel…");
    private readonly Label status = new() { Dock = DockStyle.Fill, ForeColor = Ui.Secondary, TextAlign = ContentAlignment.MiddleLeft };
    private readonly Label channelName = new() { Dock = DockStyle.Fill, ForeColor = Color.White, Text = "# welcome",
        Font = new Font("Segoe UI Semibold", 12), TextAlign = ContentAlignment.MiddleLeft };
    private readonly Button send = Ui.Button("Send", 90);
    private readonly TextBox search = Ui.Input("Search recent messages...");
    private readonly List<ChatMessage> cachedMessages = [];
    private readonly Label account = new() { Dock=DockStyle.Fill, ForeColor=Ui.Secondary, TextAlign=ContentAlignment.MiddleLeft };
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 15000 };
    private readonly List<Room> roomItems = [];
    private bool loading, sending;
    private Guid? selectedRoom;
    private readonly SemaphoreSlim refreshGate = new(1, 1);

    public ChatWindow(Supabase client)
    {
        api = client;
        Text = "ZuzuCord V2 — Desktop"; Size = new Size(1270, 800); MinimumSize = new Size(850, 550);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Ui.Background; ForeColor = Color.White; Font = Ui.Font;

        var header = new TableLayoutPanel { Dock = DockStyle.Top, Height = 66, ColumnCount = 5,
            BackColor = Ui.Panel, Padding = new Padding(17, 10, 17, 8) };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 205));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 160));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 160));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 160));
        header.Controls.Add(new Label { Text = "ZuzuCord  /  V2", Dock = DockStyle.Fill,
            Font = new Font("Segoe UI Semibold", 16), ForeColor = Color.White, TextAlign = ContentAlignment.MiddleLeft }, 0, 0);
        header.Controls.Add(status, 1, 0);
        var reload = SiticoneShell.Action("Refresh", 125);
        header.Controls.Add(reload, 2, 0);
        var profile = SiticoneShell.Action("My profile", 135);
        header.Controls.Add(profile, 3, 0);
        profile.Click += (_, _) => { using var dialog = new ProfileForm(api); dialog.ShowDialog(this); };
        var friendsButton = SiticoneShell.Action("Friends / DMs", 138);
        header.Controls.Add(friendsButton, 4, 0);
        friendsButton.Click += (_, _) => { using var friendsDialog = new FriendsForm(api); friendsDialog.ShowDialog(this); };

        var shell = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 252));
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        var sidebar = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, BackColor = Ui.Side };
        sidebar.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
        sidebar.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        sidebar.RowStyles.Add(new RowStyle(SizeType.Absolute, 65));
        sidebar.Controls.Add(new Label { Dock = DockStyle.Fill, Text = "  CHANNELS",
            ForeColor = Ui.Secondary, TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI Semibold", 10) }, 0, 0);
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
        shell.Controls.Add(sidebar, 0, 0);

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
        shell.Controls.Add(right, 1, 0);
        Controls.Add(shell); Controls.Add(header); Controls.Add(SiticoneShell.Accent());

        rooms.SelectedIndexChanged += async (_, _) => await SelectRoom();
        send.Click += async (_, _) => await Send();
        compose.KeyDown += async (_, e) => { if (e.KeyCode == Keys.Enter && !e.Shift) { e.SuppressKeyPress = true; await Send(); } };
        reload.Click += async (_, _) => await Refresh();
        search.TextChanged += (_, _) => RenderMessages();
        KeyPreview = true;
        KeyDown += (_,e)=> { if(e.Control && e.KeyCode==Keys.F){e.SuppressKeyPress=true;search.Focus();} };
        search.AccessibleName = "Search messages loaded in the current channel";
        timer.Tick += async (_, _) => await Refresh();
        Shown += async (_, _) => { await LoadRooms(); timer.Start(); };
        FormClosed += (_, _) => { timer.Stop(); timer.Dispose(); refreshGate.Dispose(); };
        status.Text = "ZUZUCORD  •  connected";
        var identity = Supabase.VisibleIdentity(api.Current?.Email ?? "member");
        account.Text = "  " + identity;
        transcript.Text = "Welcome to ZuzuCord V2.\n\nChoose a channel to join the conversation.";
    }

    private async Task LoadRooms()
    {
        try
        {
            var list = await api.RoomsAsync();
            roomItems.Clear(); roomItems.AddRange(list);
            rooms.Items.Clear();
            foreach (var room in roomItems) rooms.Items.Add("  #  " + room.Name);
            status.Text = $"{roomItems.Count} channels  •  live sync";
            if (rooms.Items.Count > 0) rooms.SelectedIndex = 0;
            else transcript.Text = "No channels are available yet.";
        }
        catch (Exception e) { Report(e); }
    }

    private async Task SelectRoom()
    {
        var index = rooms.SelectedIndex;
        if (index < 0 || index >= roomItems.Count) return;
        selectedRoom = roomItems[index].Id;
        channelName.Text = "  #  " + roomItems[index].Name + "     " + roomItems[index].Description;
        cachedMessages.Clear();
        transcript.Text = "Loading messages…";
        await Refresh();
    }

    private async Task Refresh()
    {
        if (selectedRoom is not Guid room || loading) return;
        if (!await refreshGate.WaitAsync(0)) return;
        loading = true;
        try
        {
            var list = await api.MessagesAsync(room);
            // A channel switch during the request should not show results for the old channel.
            if (selectedRoom != room) return;
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
        if (transcript.Text == next) return;
        transcript.Text = next;
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
            await api.SendAsync(room, content);
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
