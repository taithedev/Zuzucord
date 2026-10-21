using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class ServerMembersForm : Form
{
    private readonly Supabase api;
    private readonly ZuzuServer server;
    private readonly List<ServerMember> rows = [];
    private readonly ListBox list = new() {
        Dock = DockStyle.Fill, BackColor = ThemeColors.Side, ForeColor = Color.White,
        BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 11), IntegralHeight = false
    };
    private readonly Label message = new() {
        Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted,
        Text = "Members may leave at any time. Only the owner can promote moderators."
    };
    private readonly Button promote = Ui.Button("Make admin", 120);
    private readonly Button demote = Ui.Button("Make member", 125);
    private readonly Button remove = Ui.Button("Remove member", 140);
    private readonly Button reload = Ui.Button("Refresh", 95);
    private bool busy;

    public ServerMembersForm(Supabase client, ZuzuServer selected)
    {
        api = client; server = selected;
        Text = "ZuzuCord · " + server.Name + " · Members";
        Size = new Size(740, 595); MinimumSize = new Size(640, 460);
        StartPosition = FormStartPosition.CenterParent;
        BackColor = ThemeColors.Background; ForeColor = Color.White; Font = Ui.Font;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 4, Padding = new Padding(24) };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        layout.Controls.Add(new Label {
            Text = server.Name.ToUpperInvariant() + "  /  MEMBERS",
            Dock = DockStyle.Fill, ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 17)
        }, 0, 0);
        layout.Controls.Add(list, 0, 1);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill };
        actions.Controls.Add(promote); actions.Controls.Add(demote);
        actions.Controls.Add(remove); actions.Controls.Add(reload);
        layout.Controls.Add(actions, 0, 2);
        layout.Controls.Add(message, 0, 3);
        Controls.Add(layout);
        list.SelectedIndexChanged += (_, _) => UpdateActions();
        promote.Click += async (_, _) => await ChangeRole("admin");
        demote.Click += async (_, _) => await ChangeRole("member");
        remove.Click += async (_, _) => await Remove();
        reload.Click += async (_, _) => await LoadMembers();
        Shown += async (_, _) => await LoadMembers();
        UpdateActions();
    }

    private ServerMember? Selected =>
        list.SelectedIndex >= 0 && list.SelectedIndex < rows.Count
            ? rows[list.SelectedIndex] : null;

    private void UpdateActions()
    {
        var entry = Selected;
        var mine = rows.Find(m => m.UserId == api.Current?.UserId);
        var owner = mine?.Role == "owner";
        var admin = mine?.Role == "admin";
        var other = entry is not null && entry.UserId != api.Current?.UserId;
        promote.Enabled = demote.Enabled = !busy && owner && other && entry?.Role != "owner";
        remove.Enabled = !busy && entry is not null && entry.Role != "owner" &&
            (!other || owner || (admin && entry.Role == "member"));
        reload.Enabled = !busy;
        if (entry is not null)
            remove.Text = other ? "Remove member" : "Leave server";
    }

    private async Task LoadMembers()
    {
        if (busy) return;
        busy = true; UpdateActions();
        try
        {
            var members = await api.ServerMembersAsync(server.Id);
            rows.Clear(); rows.AddRange(members);
            list.Items.Clear();
            foreach (var user in rows)
                list.Items.Add("  @" + user.Username + "     ·     " + user.Role.ToUpperInvariant());
            message.Text = rows.Count + " members · Server roles are managed through Supabase permissions.";
        }
        catch (Exception error) { message.Text = "Could not load members: " + error.Message; }
        finally { busy = false; UpdateActions(); }
    }

    private async Task ChangeRole(string role)
    {
        var entry = Selected;
        if (busy || entry is null) return;
        busy = true; UpdateActions();
        try
        {
            await api.ChangeServerRoleAsync(server.Id, entry.UserId, role);
            message.Text = "Role updated.";
        }
        catch (Exception error) { message.Text = error.Message; }
        finally { busy = false; UpdateActions(); }
        await LoadMembers();
    }

    private async Task Remove()
    {
        var entry = Selected;
        if (busy || entry is null || entry.Role == "owner") return;
        var leaving = entry.UserId == api.Current?.UserId;
        if (MessageBox.Show(this,
            leaving ? "Leave this server?" : "Remove @" + entry.Username + " from this server?",
            "Confirm membership change", MessageBoxButtons.YesNo, MessageBoxIcon.Question)
            != DialogResult.Yes) return;
        busy = true; UpdateActions();
        try
        {
            await api.RemoveServerMemberAsync(server.Id, entry.UserId);
            if (leaving) { DialogResult = DialogResult.OK; Close(); return; }
            message.Text = "Member removed from the server.";
        }
        catch (Exception error) { message.Text = error.Message; }
        finally { busy = false; UpdateActions(); }
        await LoadMembers();
    }
}
