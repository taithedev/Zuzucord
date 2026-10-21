using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class ServerPrompt : Form
{
    private readonly TextBox entry = Ui.Input("");
    private readonly Label hint = new() { Dock = DockStyle.Fill, ForeColor = ThemeColors.Muted };
    private readonly Button confirm = Ui.Button("Continue", 115);
    public string Value => entry.Text.Trim();

    public ServerPrompt(string heading, string description, string placeholder, int limit = 48)
    {
        Text = "ZuzuCord · " + heading;
        Size = new Size(520, 290); MinimumSize = new Size(470, 270);
        StartPosition = FormStartPosition.CenterParent;
        BackColor = ThemeColors.Background; ForeColor = Color.White;
        Font = Ui.Font;
        entry.PlaceholderText = placeholder; entry.MaxLength = limit;
        var content = new TableLayoutPanel
        {
            Dock = DockStyle.Fill, Padding = new Padding(28),
            RowCount = 4, ColumnCount = 1
        };
        content.RowStyles.Add(new RowStyle(SizeType.Absolute, 47));
        content.RowStyles.Add(new RowStyle(SizeType.Absolute, 70));
        content.RowStyles.Add(new RowStyle(SizeType.Absolute, 50));
        content.RowStyles.Add(new RowStyle(SizeType.Absolute, 50));
        content.Controls.Add(new Label
        {
            Dock = DockStyle.Fill, Text = heading,
            Font = new Font("Segoe UI Semibold", 18), ForeColor = Color.White
        }, 0, 0);
        hint.Text = description;
        content.Controls.Add(hint, 0, 1);
        content.Controls.Add(entry, 0, 2);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        var cancel = Ui.Button("Cancel", 90);
        buttons.Controls.Add(confirm); buttons.Controls.Add(cancel);
        content.Controls.Add(buttons, 0, 3);
        Controls.Add(content);
        confirm.Click += (_, _) =>
        {
            if (Value.Length == 0) { hint.Text = "Enter a value to continue."; return; }
            DialogResult = DialogResult.OK;
            Close();
        };
        cancel.Click += (_, _) => { DialogResult = DialogResult.Cancel; Close(); };
        AcceptButton = confirm; CancelButton = cancel;
    }
}
