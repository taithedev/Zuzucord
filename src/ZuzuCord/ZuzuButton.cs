using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ZuzuCord;

/// <summary>OLED-style fallback for buttons that must implement IButtonControl
/// (AcceptButton / CancelButton). Siticone handles the primary desktop navigation.</summary>
internal sealed class ZuzuButton : Button
{
    private bool hovering;
    private bool pressed;

    public ZuzuButton()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        FlatStyle = FlatStyle.Flat;
        Cursor = Cursors.Hand;
        TabStop = true;
    }

    protected override void OnMouseEnter(EventArgs e) { hovering = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hovering = false; pressed = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e) { pressed = true; Invalidate(); base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { pressed = false; Invalidate(); base.OnMouseUp(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new Rectangle(1, 1, Math.Max(1, Width - 3), Math.Max(1, Height - 3));
        using var path = Round(rect, 10);
        var baseColor = BackColor;
        var fill = !Enabled ? Color.FromArgb(24, 24, 27)
            : pressed ? Color.FromArgb(77, 77, 84)
            : hovering ? ControlPaint.Light(baseColor, .2f) : baseColor;
        using var brush = new SolidBrush(fill);
        using var outline = new Pen(Focused ? Color.FromArgb(235,235,240) : Color.FromArgb(62,62,69));
        e.Graphics.FillPath(brush, path);
        e.Graphics.DrawPath(outline, path);
        var labelColor = Enabled ? ForeColor : Color.FromArgb(107,107,114);
        TextRenderer.DrawText(e.Graphics, Text, Font, rect, labelColor,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter |
            TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }

    private static GraphicsPath Round(Rectangle rect, int radius)
    {
        int d = Math.Min(radius * 2, Math.Min(rect.Width, rect.Height));
        var path = new GraphicsPath();
        path.AddArc(rect.Left, rect.Top, d, d, 180, 90);
        path.AddArc(rect.Right - d, rect.Top, d, d, 270, 90);
        path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
        path.AddArc(rect.Left, rect.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }
}
