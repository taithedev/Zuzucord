using System.Drawing;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace ZuzuCord;

internal static class ThemeColors
{
    public static string Theme { get; private set; } = "oled";
    public static string AccentHex { get; private set; } = "#c9c9d2";
    public static Color Accent => ColorTranslator.FromHtml(AccentHex);
    public static Color Background => Theme switch
    {
        "graphite" => Color.FromArgb(19, 19, 22),
        "midnight" => Color.FromArgb(7, 10, 23),
        _ => Color.Black
    };
    public static Color Panel => Theme switch
    {
        "graphite" => Color.FromArgb(29, 29, 34),
        "midnight" => Color.FromArgb(16, 21, 36),
        _ => Color.FromArgb(13, 13, 15)
    };
    public static Color Side => Theme switch
    {
        "graphite" => Color.FromArgb(24, 24, 28),
        "midnight" => Color.FromArgb(12, 16, 29),
        _ => Color.FromArgb(7, 7, 9)
    };
    public static Color Input => Theme switch
    {
        "graphite" => Color.FromArgb(37, 37, 42),
        "midnight" => Color.FromArgb(27, 32, 49),
        _ => Color.FromArgb(22, 22, 26)
    };
    public static Color Muted => Color.FromArgb(174, 174, 183);

    public static string NormalizeTheme(string? value) =>
        value is "oled" or "graphite" or "midnight" ? value : "oled";

    public static string NormalizeAccent(string? hex)
    {
        return hex is not null && Regex.IsMatch(hex, "^#[0-9a-fA-F]{6}$")
            ? hex.ToLowerInvariant() : "#c9c9d2";
    }

    public static void Configure(string theme, string accent)
    {
        Theme = NormalizeTheme(theme);
        AccentHex = NormalizeAccent(accent);
    }

    public static void ApplyToOpenForms()
    {
        foreach (Form window in Application.OpenForms)
        {
            Apply(window);
            window.Invalidate(true);
        }
    }

    private static void Apply(Control control)
    {
        if (control.Tag is string tag && tag == "zuzu-accent") control.BackColor = Accent;
        else if (control is Form) control.BackColor = Background;
        else if (control is RichTextBox or ListBox) { control.BackColor = Background; control.ForeColor = Color.White; }
        else if (control is TextBox) { control.BackColor = Input; control.ForeColor = Color.White; }
        else if (control is TableLayoutPanel or FlowLayoutPanel or Panel)
        {
            // Preserve the contrast between existing sidebars and center panels.
            var rgb = control.BackColor;
            if (rgb.R < 35 && rgb.G < 35 && rgb.B < 50)
                control.BackColor = rgb.R < 12 ? Side : Panel;
        }
        else if (control is Label label && label.ForeColor != Color.White)
            label.ForeColor = Muted;
        foreach (Control child in control.Controls) Apply(child);
    }
}
