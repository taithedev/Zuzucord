using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class LoginForm : Form
{
    private readonly Supabase api;
    private readonly TextBox email = Ui.Input("Username or username@zuzucord.com");
    private readonly TextBox password = Ui.Input("Password");
    private readonly Label feedback = new() { Dock = DockStyle.Fill, ForeColor = Ui.Secondary, Text = "Sign in with your ZuzuCord ID or existing account email.", TextAlign = ContentAlignment.MiddleCenter };
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
        layout.Controls.Add(new Label { Dock = DockStyle.Fill, Text = "ZUZUCORD\nYour community. One place.", Font = new Font("Segoe UI Semibold", 19), TextAlign = ContentAlignment.MiddleCenter }, 0, 0);
        layout.Controls.Add(email, 0, 1);
        layout.Controls.Add(password, 0, 2);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight };
        actions.Controls.Add(signIn); actions.Controls.Add(signUp);
        layout.Controls.Add(actions, 0, 3);
        layout.Controls.Add(feedback, 0, 4);
        Controls.Add(layout); Controls.Add(SiticoneShell.Accent());
        signIn.Click += async (_, _) => await Submit(false);
        signUp.Click += async (_, _) => await Submit(true);
        AcceptButton = signIn;
    }
    private async Task Submit(bool create)
    {
        var identifier = email.Text.Trim().ToLowerInvariant();
        const string domain = "@zuzucord.com";
        var usernameAlias = identifier.EndsWith(domain, StringComparison.Ordinal);
        var usernameSignup = create && (!identifier.Contains('@') || usernameAlias);
        var username = usernameAlias ? identifier[..^domain.Length] : identifier;

        if (string.IsNullOrWhiteSpace(identifier) || password.Text.Length < (usernameSignup ? 10 : 6))
        {
            feedback.Text = usernameSignup
                ? "Choose a username and password with at least 10 characters."
                : "Enter your account identifier and password (6+ characters).";
            return;
        }

        signIn.Enabled = signUp.Enabled = false;
        feedback.Text = create ? "Creating account…" : "Signing in…";
        try
        {
            if (create)
            {
                if (usernameSignup)
                    await api.RegisterUsernameAsync(username, password.Text);
                else
                    await api.SignUpAsync(identifier, password.Text);
            }
            else await api.SignInAsync(identifier, password.Text);

            if (api.Current is null)
                feedback.Text = usernameSignup
                    ? "Account created. Sign in using " + username + domain + "."
                    : "Check your email for confirmation if prompted, then sign in.";
            else { DialogResult = DialogResult.OK; Close(); }
        }
        catch (Exception error) { feedback.Text = error.Message; }
        finally { password.Clear(); signIn.Enabled = signUp.Enabled = true; }
    }
}
