using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class LoginForm : Form
{
    private readonly Supabase api;
    private readonly TextBox email = Ui.Input("Email or username");
    private readonly TextBox password = Ui.Input("Password");
    private readonly Label feedback = new() { Dock = DockStyle.Fill, ForeColor = Ui.Secondary, Text = "Use your email or ZuzuCord username.", TextAlign = ContentAlignment.MiddleCenter };
    private readonly Button signIn = Ui.Button("Sign in", 140);
    private readonly Button signUp = Ui.Button("Create account", 150);
    public LoginForm(Supabase client)
    {
        api = client;
        Text = "ZuzuCord — Sign In"; Size = new Size(520, 460);
        MinimumSize = new Size(480, 420);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Ui.Background; ForeColor = Color.White; Font = Ui.Font;
        password.UseSystemPasswordChar = true;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(42, 32, 42, 32), RowCount = 5, ColumnCount = 1 };
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 45));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 45));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 54));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 76));
        layout.Controls.Add(new Label { Dock = DockStyle.Fill, Text = "ZuzuCord V2\nYour community, one place.", Font = new Font("Segoe UI Semibold", 19), TextAlign = ContentAlignment.MiddleCenter }, 0, 0);
        layout.Controls.Add(email, 0, 1);
        layout.Controls.Add(password, 0, 2);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight };
        actions.Controls.Add(signIn); actions.Controls.Add(signUp);
        layout.Controls.Add(actions, 0, 3);
        layout.Controls.Add(feedback, 0, 4);
        Controls.Add(layout);
        signIn.Click += async (_, _) => await Submit(false);
        signUp.Click += async (_, _) => await Submit(true);
        AcceptButton = signIn;
    }
    private async Task Submit(bool create)
    {
        if (string.IsNullOrWhiteSpace(email.Text) || password.Text.Length < (create && !email.Text.Contains('@') ? 10 : 6))
        {
            feedback.Text = create && !email.Text.Contains('@') ? "Username sign-up requires a password of 10+ characters." : "Enter an email/username and a password of at least 6 characters.";
            return;
        }
        signIn.Enabled = signUp.Enabled = false;
        feedback.Text = create ? "Creating account…" : "Signing in…";
        try
        {
            if (create)
            {
                if (email.Text.Contains('@')) await api.SignUpAsync(email.Text.Trim(), password.Text);
                else await api.RegisterUsernameAsync(email.Text.Trim().ToLowerInvariant(), password.Text);
            }
            else await api.SignInAsync(email.Text.Trim(), password.Text);
            if (api.Current is null) feedback.Text = create && !email.Text.Contains('@')
                ? "Username account created. Click Sign in to continue."
                : "Account created. If prompted, check your email for a confirmation link, then sign in.";
            else { DialogResult = DialogResult.OK; Close(); }
        }
        catch (Exception e) { feedback.Text = e.Message; }
        finally { password.Clear(); signIn.Enabled = signUp.Enabled = true; }
    }
}
