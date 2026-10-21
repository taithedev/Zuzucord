using System.Drawing;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class LoginForm : Form
{
    private readonly Supabase api;
    private readonly UserSettings settings;
    private readonly CheckBox remember = new() { Text = "Remember my login securely on this Windows account", Dock = DockStyle.Fill, ForeColor = Color.White };
    private readonly TextBox email = Ui.Input("Username or username@zuzucord.com");
    private readonly TextBox password = Ui.Input("Password");
    private readonly Label feedback = new() { Dock = DockStyle.Fill, ForeColor = Ui.Secondary, Text = "Sign in with your ZuzuCord ID or existing account email.", TextAlign = ContentAlignment.MiddleCenter };
    private readonly Button signIn = Ui.Button("Sign in", 140);
    private readonly Button signUp = Ui.Button("Create account", 150);
    public LoginForm(Supabase client, UserSettings preferences)
    {
        api = client;
        settings = preferences;
        remember.Checked = preferences.RememberLogin;
        Text = "ZuzuCord — Sign In"; Size = new Size(520, 460);
        MinimumSize = new Size(480, 420);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Ui.Background; ForeColor = Color.White; Font = Ui.Font;
        password.UseSystemPasswordChar = true;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(42, 32, 42, 32), RowCount = 6, ColumnCount = 1 };
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 45));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 45));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 54));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 76));
        layout.Controls.Add(new Label { Dock = DockStyle.Fill, Text = "ZUZUCORD\nYour community. One place.", Font = new Font("Segoe UI Semibold", 19), TextAlign = ContentAlignment.MiddleCenter }, 0, 0);
        layout.Controls.Add(email, 0, 1);
        layout.Controls.Add(password, 0, 2);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight };
        actions.Controls.Add(signIn); actions.Controls.Add(signUp);
        layout.Controls.Add(actions, 0, 3);
        layout.Controls.Add(remember, 0, 4);
        layout.Controls.Add(feedback, 0, 5);
        Controls.Add(layout); Controls.Add(SiticoneShell.Accent());
        signIn.Click += async (_, _) => await Submit(false);
        signUp.Click += async (_, _) => await Submit(true);
        AcceptButton = signIn;
        Shown += async (_, _) => await TryAutoLogin();
    }
    private async Task TryAutoLogin()
    {
        if (!settings.RememberLogin) return;
        var token = LoginVault.Read();
        if (string.IsNullOrWhiteSpace(token)) return;
        signIn.Enabled = signUp.Enabled = false;
        feedback.Text = "Restoring your saved login…";
        try
        {
            await api.RestoreAsync(token);
            DialogResult = DialogResult.OK;
            Close();
        }
        catch
        {
            LoginVault.Clear();
            feedback.Text = "Your saved session expired. Please sign in again.";
        }
        finally { signIn.Enabled = signUp.Enabled = true; }
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
        settings.RememberLogin = remember.Checked;
        try { settings.Save(); }
        catch (Exception error) { feedback.Text = "Could not save preferences: " + error.Message; }
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
