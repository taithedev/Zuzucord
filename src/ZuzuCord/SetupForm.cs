using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class SetupForm : Form
{
    private readonly UserSettings settings;
    private readonly ComboBox theme = new()
    {
        DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill,
        BackColor = Color.FromArgb(28,28,33), ForeColor = Color.White, FlatStyle = FlatStyle.Flat
    };
    private readonly CheckBox remember = new()
    {
        Text = "Keep me signed in on this Windows account (encrypted with Windows DPAPI)",
        Dock = DockStyle.Fill, ForeColor = Color.White, Checked = true
    };
    public SetupForm(UserSettings preferences)
    {
        settings = preferences;
        Text = "Welcome to ZuzuCord · Setup";
        Width = 660; Height = 480; MinimumSize = new Size(600, 450);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = ThemeColors.Background; ForeColor = Color.White; Font = Ui.Font;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(34), RowCount = 7 };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 64));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 74));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 43));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 64));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 60));
        layout.Controls.Add(new Label
        {
            Text = "WELCOME TO ZUZUCORD", Dock = DockStyle.Fill,
            Font = new Font("Segoe UI Semibold", 20), ForeColor = Color.White
        }, 0, 0);
        layout.Controls.Add(new Label
        {
            Text = "Set up your Windows app. Your choices are saved locally and can be changed later in Appearance.",
            Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted
        }, 0, 1);
        layout.Controls.Add(new Label { Text = "DEFAULT THEME", Dock = DockStyle.Fill,
            ForeColor = ThemeColors.Muted }, 0, 2);
        theme.Items.AddRange(["OLED Black", "Graphite", "Midnight"]);
        theme.SelectedIndex = settings.Theme switch { "graphite" => 1, "midnight" => 2, _ => 0 };
        layout.Controls.Add(theme, 0, 3);
        remember.Checked = settings.RememberLogin;
        layout.Controls.Add(remember, 0, 4);
        layout.Controls.Add(new Label
        {
            Text = "The Windows login is protected using Windows user-account encryption. The application does not store your password. ZuzuCord ID aliases are not email inboxes.",
            Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted
        }, 0, 5);
        var start = Ui.Button("Finish setup", 170);
        start.Click += (_, _) =>
        {
            settings.Theme = theme.SelectedIndex switch { 1 => "graphite", 2 => "midnight", _ => "oled" };
            settings.RememberLogin = remember.Checked;
            settings.SetupCompleted = true;
            try { settings.Save(); }
            catch (Exception error) { MessageBox.Show(this, error.Message, "Could not save setup"); return; }
            ThemeColors.Configure(settings.Theme, settings.Accent);
            DialogResult = DialogResult.OK; Close();
        };
        layout.Controls.Add(start, 0, 6);
        Controls.Add(layout);
        AcceptButton = start;
    }
}
