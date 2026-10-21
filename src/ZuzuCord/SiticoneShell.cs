using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;

namespace ZuzuCord;

/// <summary>
/// Siticone integration layer for WinForms. Keeps the existing app usable if a
/// Siticone control is unavailable at runtime, while using real Siticone
/// components on a supported Windows installation.
/// </summary>
internal static class SiticoneShell
{
    private static readonly Lazy<Assembly?> Kit = new(() =>
    {
        try { return Assembly.Load("Siticone.NetCore.UI"); }
        catch { return null; }
    });

    private static Control? Create(string shortName)
    {
        try
        {
            var type = Kit.Value?.GetTypes().FirstOrDefault(t =>
                t.Name.Equals(shortName, StringComparison.OrdinalIgnoreCase)
                && typeof(Control).IsAssignableFrom(t)
                && !t.IsAbstract);
            return type is null ? null : (Control?)Activator.CreateInstance(type);
        }
        catch { return null; }
    }

    private static void Set(object source, string name, object value)
    {
        try
        {
            var property = source.GetType().GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
            if (property?.CanWrite == true && property.PropertyType.IsAssignableFrom(value.GetType()))
                property.SetValue(source, value);
        }
        catch { /* Optional visual property on varying Siticone versions. */ }
    }

    public static Control Accent()
    {
        var panel = Create("SiticonePanel") ?? new Panel();
        panel.Dock = DockStyle.Top;
        panel.Height = 3;
        panel.BackColor = Color.FromArgb(180, 180, 187);
        Set(panel, "FillColor", Color.FromArgb(180, 180, 187));
        return panel;
    }

    public static Control Action(string caption, int width, bool primary = false)
    {
        var control = Create("SiticoneButton") ?? new Button { FlatStyle = FlatStyle.Flat };
        control.Text = caption;
        control.Width = width;
        control.Height = 38;
        control.Margin = new Padding(4);
        control.Cursor = Cursors.Hand;
        control.Font = new Font("Segoe UI Semibold", 10);
        control.BackColor = primary ? Color.FromArgb(243, 243, 245) : Color.FromArgb(37, 37, 42);
        control.ForeColor = primary ? Color.Black : Color.White;
        var background = control.BackColor;
        Set(control, "ButtonBackColor", background);
        Set(control, "TextColor", control.ForeColor);
        Set(control, "HoverBackColor", primary ? Color.White : Color.FromArgb(64, 64, 70));
        Set(control, "PressedBackColor", Color.FromArgb(94, 94, 101));
        Set(control, "BorderColor", Color.FromArgb(79, 79, 86));
        Set(control, "CornerRadiusTopLeft", 11);
        Set(control, "CornerRadiusTopRight", 11);
        Set(control, "CornerRadiusBottomLeft", 11);
        Set(control, "CornerRadiusBottomRight", 11);
        Set(control, "EnableRippleEffect", true);
        return control;
    }
}
