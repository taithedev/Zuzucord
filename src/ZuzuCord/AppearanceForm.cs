using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class AppearanceForm : Form
{
    private readonly Supabase api;
    private readonly UserSettings settings;
    private readonly ComboBox themes = new()
    {
        Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDownList,
        BackColor = ThemeColors.Input, ForeColor = Color.White, FlatStyle = FlatStyle.Flat
    };
    private readonly Panel sample = new() { Dock = DockStyle.Fill, BackColor = ThemeColors.Accent };
    private readonly Label detail = new()
    {
        Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted,
        Text = "The OLED Black theme is the default. Theme and accent changes are saved on this PC."
    };
    private readonly CheckBox betaSync = new()
    {
        Text = "Sync theme between beta website and this Windows app",
        Dock = DockStyle.Fill, ForeColor = Color.White, Enabled = false
    };
    private readonly Button changeColor = Ui.Button("Choose accent color", 200);
    private readonly Button save = Ui.Button("Apply & save", 150);
    private readonly Button import = Ui.Button("Import website colors", 190);
    private Color selectedColor;
    private bool hasBeta;

    public AppearanceForm(Supabase client, UserSettings preferences)
    {
        api = client; settings = preferences;
        selectedColor = ThemeColors.Accent;
        Text = "ZuzuCord · Appearance & Colors";
        Size = new Size(680, 490); MinimumSize = new Size(610, 450);
        StartPosition = FormStartPosition.CenterParent;
        BackColor = ThemeColors.Background; ForeColor = Color.White; Font = Ui.Font;

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill, Padding = new Padding(28),
            ColumnCount = 1, RowCount = 10, BackColor = ThemeColors.Background
        };
        foreach (int height in new[] { 52, 42, 34, 50, 34, 55, 60, 0, 48, 60 })
            layout.RowStyles.Add(height == 0 ? new RowStyle(SizeType.Percent, 100)
                : new RowStyle(SizeType.Absolute, height));

        layout.Controls.Add(new Label
        {
            Text = "APPEARANCE", Font = new Font("Segoe UI Semibold", 21),
            ForeColor = Color.White, Dock = DockStyle.Fill
        }, 0, 0);
        layout.Controls.Add(new Label
        {
            Text = "Personalize your ZuzuCord interface without changing other users' colors.",
            Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted
        }, 0, 1);
        layout.Controls.Add(new Label { Text = "THEME", Dock = DockStyle.Fill,
            ForeColor = ThemeColors.Muted }, 0, 2);
        themes.Items.AddRange(["OLED Black (default)", "Graphite", "Midnight"]);
        themes.SelectedIndex = settings.Theme switch { "graphite" => 1, "midnight" => 2, _ => 0 };
        layout.Controls.Add(themes, 0, 3);
        layout.Controls.Add(new Label { Text = "ACCENT COLOR", Dock = DockStyle.Fill,
            ForeColor = ThemeColors.Muted }, 0, 4);
        var colors = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, BackColor = ThemeColors.Background };
        colors.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 230));
        colors.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        colors.Controls.Add(changeColor, 0, 0);
        colors.Controls.Add(sample, 1, 0);
        layout.Controls.Add(colors, 0, 5);
        betaSync.Checked = settings.BetaSyncEnabled;
        layout.Controls.Add(betaSync, 0, 6);
        layout.Controls.Add(detail, 0, 7);
        var footer = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        footer.Controls.Add(save);
        var reset = Ui.Button("Restore defaults", 160);
        footer.Controls.Add(reset);
        import.Enabled = false;
        layout.Controls.Add(import, 0, 8);
        layout.Controls.Add(footer, 0, 9);
        Controls.Add(layout);

        changeColor.Click += (_, _) =>
        {
            using var dialog = new ColorDialog
            {
                FullOpen = true, Color = selectedColor, AllowFullOpen = true,
                AnyColor = true, SolidColorOnly = true
            };
            if (dialog.ShowDialog(this) != DialogResult.OK) return;
            selectedColor = dialog.Color;
            sample.BackColor = selectedColor;
        };
        reset.Click += (_, _) =>
        {
            themes.SelectedIndex = 0;
            selectedColor = ColorTranslator.FromHtml("#c9c9d2");
            sample.BackColor = selectedColor;
            betaSync.Checked = false;
            detail.Text = "OLED Black and the original neutral accent are selected. Click Apply & save.";
        };
        save.Click += async (_, _) => await SaveAsync();
        import.Click += async (_, _) => await ImportWebsiteAsync();
        Shown += async (_, _) => await CheckBetaAsync();
    }

    private async Task CheckBetaAsync()
    {
        try
        {
            hasBeta = await api.IsBetaTesterAsync();
            betaSync.Enabled = hasBeta;
            import.Enabled = hasBeta;
            detail.Text = hasBeta
                ? "Approved beta account. You can synchronize your theme and color across website and desktop."
                : "Website sync is reserved for invited beta testers; local color editing is available to everyone.";
        }
        catch
        {
            hasBeta = false;
            betaSync.Enabled = false;
            import.Enabled = false;
            detail.Text = "Could not check beta access. Local color editing is still available.";
        }
    }

    private async Task ImportWebsiteAsync()
    {
        if (!hasBeta) return;
        import.Enabled = false;
        try
        {
            var remote = await api.ReadBetaThemeAsync();
            if (remote is null)
            {
                detail.Text = "No website theme saved yet. Choose colors and apply, then edit from the beta website.";
                return;
            }
            themes.SelectedIndex = remote.Theme switch { "graphite" => 1, "midnight" => 2, _ => 0 };
            selectedColor = ColorTranslator.FromHtml(ThemeColors.NormalizeAccent(remote.Accent));
            sample.BackColor = selectedColor;
            betaSync.Checked = remote.SyncEnabled;
            detail.Text = "Website settings loaded. Click Apply & save to use them in your Windows app.";
        }
        catch (Exception error) { detail.Text = "Unable to import website settings: " + error.Message; }
        finally { import.Enabled = hasBeta; }
    }

    private async Task SaveAsync()
    {
        save.Enabled = false;
        try
        {
            settings.Theme = themes.SelectedIndex switch { 1 => "graphite", 2 => "midnight", _ => "oled" };
            settings.Accent = ColorTranslator.ToHtml(selectedColor);
            settings.BetaSyncEnabled = hasBeta && betaSync.Checked;
            settings.Save();
            ThemeColors.Configure(settings.Theme, settings.Accent);
            ThemeColors.ApplyToOpenForms();

            if (hasBeta)
                await api.SaveBetaThemeAsync(settings.Theme, settings.Accent, settings.BetaSyncEnabled);
            detail.Text = settings.BetaSyncEnabled
                ? "Saved locally and synchronized with your approved beta account."
                : "Saved locally. Changes will also be applied on your next launch.";
        }
        catch (Exception e)
        {
            detail.Text = "Saved locally; cloud sync failed: " + e.Message;
        }
        finally { save.Enabled = true; }
    }
}
