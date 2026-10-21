using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class ServerBotForm : Form
{
    private readonly Supabase api;
    private readonly ZuzuServer server;
    private readonly CheckBox enabled = new()
    {
        Text = "Enable ZuzuBot commands in this server", Dock = DockStyle.Fill,
        ForeColor = Color.White
    };
    private readonly Label message = new()
    {
        Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted,
        Text = "Loading bot permissions…", AutoSize = false
    };
    private readonly Button save = Ui.Button("Save bot settings", 180);

    public ServerBotForm(Supabase client, ZuzuServer selected)
    {
        api = client; server = selected;
        Text = "ZuzuCord · ZuzuBot settings";
        Size = new Size(610, 415); MinimumSize = new Size(560, 390);
        StartPosition = FormStartPosition.CenterParent;
        BackColor = ThemeColors.Background; ForeColor = Color.White; Font = Ui.Font;
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill, Padding = new Padding(28), RowCount = 5
        };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 55));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 105));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.Controls.Add(new Label
        {
            Text = "ZUZUBOT  /  " + server.Name.ToUpperInvariant(),
            Dock = DockStyle.Fill, ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 18)
        }, 0, 0);
        layout.Controls.Add(enabled, 0, 1);
        layout.Controls.Add(new Label
        {
            Text = "Commands: /help, /ping, /rules, /members, /roll, /time\n\nCommands run on Supabase. Members cannot impersonate bot replies. A short cooldown prevents command spam.",
            Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted
        }, 0, 2);
        layout.Controls.Add(save, 0, 3);
        layout.Controls.Add(message, 0, 4);
        Controls.Add(layout);
        save.Enabled = false;
        save.Click += async (_, _) => await SaveAsync();
        Shown += async (_, _) => await LoadAsync();
    }

    private async Task LoadAsync()
    {
        try
        {
            enabled.Checked = await api.BotEnabledAsync(server.Id);
            bool owner = server.OwnerId == api.Current?.UserId;
            enabled.Enabled = save.Enabled = owner;
            message.Text = owner
                ? "You own this server. Configure commands and save."
                : "You can use ZuzuBot commands, but only the owner can change bot settings.";
        }
        catch (Exception error) { message.Text = "Bot settings unavailable: " + error.Message; }
    }

    private async Task SaveAsync()
    {
        save.Enabled = false;
        try
        {
            var result = await api.SetBotEnabledAsync(server.Id, enabled.Checked);
            message.Text = result ? "ZuzuBot is now enabled." : "ZuzuBot is disabled in this server.";
        }
        catch (Exception error) { message.Text = "Couldn't update bot settings: " + error.Message; }
        finally { save.Enabled = server.OwnerId == api.Current?.UserId; }
    }
}
