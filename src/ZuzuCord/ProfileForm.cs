using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class ProfileForm : Form
{
    private readonly Supabase api;
    private readonly TextBox displayName = Ui.Input("Display name (40 chars max)");
    private readonly TextBox statusText = Ui.Input("Status (120 chars max)");
    private readonly Label feedback = new() { Dock = DockStyle.Fill, ForeColor = Ui.Secondary, Text = "Only your account can edit this profile.", TextAlign = ContentAlignment.MiddleLeft };
    private readonly Button save = Ui.Button("Save changes", 150);

    public ProfileForm(Supabase client)
    {
        api = client;
        Text = "ZuzuCord V2 — Profile";
        Size = new Size(540, 340); MinimumSize = new Size(480, 320);
        StartPosition = FormStartPosition.CenterParent;
        BackColor = Ui.Background; ForeColor = Color.White; Font = Ui.Font;
        displayName.MaxLength = 40; statusText.MaxLength = 120;
        var fields = new TableLayoutPanel { Dock=DockStyle.Fill, Padding = new Padding(30), RowCount=6 };
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 45));
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 30));
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 43));
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 43));
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 55));
        fields.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        fields.Controls.Add(new Label { Text = "EDIT PROFILE", Dock = DockStyle.Fill,
            Font = new Font("Segoe UI Semibold", 17), ForeColor = Color.White }, 0, 0);
        fields.Controls.Add(new Label { Text = "Your name and personal status", ForeColor = Ui.Secondary, Dock = DockStyle.Fill }, 0, 1);
        fields.Controls.Add(displayName, 0, 2);
        fields.Controls.Add(statusText, 0, 3);
        fields.Controls.Add(save, 0, 4);
        fields.Controls.Add(feedback, 0, 5);
        Controls.Add(fields);
        Shown += async (_, _) => await LoadProfile();
        save.Click += async (_, _) => await Save();
    }

    private async Task LoadProfile()
    {
        try { var p = await api.GetProfileAsync(); displayName.Text = p.DisplayName; statusText.Text = p.StatusText; }
        catch(Exception e) { feedback.Text = "Profile unavailable: " + e.Message; }
    }
    private async Task Save()
    {
        save.Enabled = false;
        try { await api.SaveProfileAsync(displayName.Text, statusText.Text); feedback.Text = "Profile saved to Supabase."; }
        catch(Exception e) { feedback.Text = "Could not save: " + e.Message; }
        finally { save.Enabled = true; }
    }
}
