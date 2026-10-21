using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class NoticeForm : Form
{
    public NoticeForm()
    {
        Text = "ZuzuCord — Before You Continue";
        Size = new Size(650, 520);
        MinimumSize = new Size(560, 480);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Ui.Background;
        ForeColor = Color.White;
        Font = Ui.Font;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(30), RowCount = 4 };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 75));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 55));
        layout.Controls.Add(new Label { Dock = DockStyle.Fill, Text = "ZUZUCORD  /  IMPORTANT NOTICE", ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 18), TextAlign = ContentAlignment.MiddleLeft }, 0, 0);
        layout.Controls.Add(new Label { Dock = DockStyle.Fill, AutoSize = false, ForeColor = Ui.Secondary, Text =
            "ZUZUCORD ACCOUNT WARNING: Accounts may be suspended or banned for violations of community rules. " +
            "Users are responsible for their own conduct, and account actions are subject to moderation.\n\n" +
            "ZuzuCord developers are not responsible for users violating community rules to the extent permitted by law. " +
            "This notice does not waive any rights you have under applicable law or excuse wrongful account actions.\n\n" +
            "ZuzuCord V2 is an independent community service, not affiliated with Discord Inc. " +
            "Discord accounts and moderation decisions are separate from ZuzuCord.\n\n" +
            "Your ZuzuCord account uses Supabase authentication. Keep your password private. " +
            "Username-only accounts cannot recover passwords by email." }, 0, 1);
        var checkbox = new CheckBox { Text = "I understand and want to open ZuzuCord V2.", Dock = DockStyle.Fill, ForeColor = Color.White };
        layout.Controls.Add(checkbox, 0, 2);
        var footer = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        var accept = Ui.Button("Agree & Open", 160); accept.Enabled = false;
        var exit = Ui.Button("Exit", 90);
        checkbox.CheckedChanged += (_, _) => accept.Enabled = checkbox.Checked;
        accept.Click += (_, _) => { DialogResult = DialogResult.OK; Close(); };
        exit.Click += (_, _) => { DialogResult = DialogResult.Cancel; Close(); };
        footer.Controls.Add(accept); footer.Controls.Add(exit);
        layout.Controls.Add(footer, 0, 3);
        Controls.Add(layout); AcceptButton = accept; CancelButton = exit;
    }
}
