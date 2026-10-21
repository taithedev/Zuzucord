using System.Drawing;
using System.Text;
using System.Windows.Forms;

namespace ZuzuCord;

internal sealed class FriendsForm : Form
{
    private readonly Supabase api;
    private readonly TextBox username = Ui.Input("Enter an exact username");
    private readonly ListBox requests = new()
    { Dock=DockStyle.Fill, BackColor=Ui.Panel, ForeColor=Color.White, BorderStyle=BorderStyle.None, Font=new Font("Segoe UI",11), IntegralHeight=false };
    private readonly Label feedback = new() { Dock=DockStyle.Fill, Text="Friends must accept your request before you can send private messages.", ForeColor=Ui.Secondary, TextAlign=ContentAlignment.MiddleLeft };
    private readonly Button add = Ui.Button("Add friend",115);
    private readonly Button accept = Ui.Button("Accept",105);
    private readonly Button decline = Ui.Button("Decline",105);
    private readonly Button dm = Ui.Button("Message",115);
    private readonly Button refresh = Ui.Button("Refresh",95);
    private readonly List<FriendRequest> items = [];
    private bool busy;

    public FriendsForm(Supabase client)
    {
        api=client; Text="ZuzuCord V2 — Friends and DMs"; Size=new Size(730,610);
        MinimumSize=new Size(590,450); StartPosition=FormStartPosition.CenterParent;
        BackColor=Ui.Background; ForeColor=Color.White; Font=Ui.Font;
        var root = new TableLayoutPanel { Dock=DockStyle.Fill, Padding=new Padding(24), RowCount=5 };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute,55));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute,55));
        root.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute,57));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute,62));
        root.Controls.Add(new Label { Text="FRIENDS & DIRECT MESSAGES", Dock=DockStyle.Fill, ForeColor=Color.White,
            Font=new Font("Segoe UI Semibold",17), TextAlign=ContentAlignment.MiddleLeft }, 0,0);
        var top=new TableLayoutPanel { Dock=DockStyle.Fill, ColumnCount=2 };
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100)); top.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,125));
        top.Controls.Add(username,0,0); top.Controls.Add(add,1,0);
        root.Controls.Add(top,0,1);
        root.Controls.Add(requests,0,2);
        var actions=new FlowLayoutPanel { Dock=DockStyle.Fill };
        actions.Controls.Add(accept); actions.Controls.Add(decline); actions.Controls.Add(dm); actions.Controls.Add(refresh);
        root.Controls.Add(actions,0,3); root.Controls.Add(feedback,0,4);
        Controls.Add(root);

        Shown += async (_,_) => await Reload();
        add.Click += async (_,_) => await Add();
        accept.Click += async (_,_) => await Respond(true);
        decline.Click += async (_,_) => await Respond(false);
        dm.Click += async (_,_) => await OpenDm();
        refresh.Click += async (_,_) => await Reload();
        requests.SelectedIndexChanged += (_,_) => SyncControls();
        username.KeyDown += async (_,e) => { if(e.KeyCode==Keys.Enter){e.SuppressKeyPress=true;await Add();} };
        SyncControls();
    }

    private void SyncControls()
    {
        var index=requests.SelectedIndex;
        var item=index>=0 && index<items.Count ? items[index] : null;
        var incoming=item is not null && item.ToUser==api.Current?.UserId && item.Status=="pending";
        accept.Enabled=decline.Enabled=!busy && incoming;
        dm.Enabled=!busy && item?.Status=="accepted";
        add.Enabled=refresh.Enabled=!busy;
    }
    private async Task Reload()
    {
        if(busy)return;
        busy=true; SyncControls();
        try
        {
            var rows=await api.FriendsAsync();
            items.Clear(); items.AddRange(rows);
            requests.Items.Clear();
            foreach(var item in items)
            {
                var other=item.FromUser==api.Current?.UserId ? item.ToUser : item.FromUser;
                var name=await api.FriendUsernameAsync(other);
                var state=item.Status switch
                {
                    "accepted"=>"FRIEND",
                    "pending" when item.ToUser==api.Current?.UserId=>"INCOMING REQUEST",
                    "pending"=>"OUTGOING REQUEST",
                    _=>"DECLINED"
                };
                requests.Items.Add("  @"+name+"   ·   "+state);
            }
            feedback.Text=items.Count==0?"No connections yet. Enter a username to send a friend request.":$"{items.Count} connection(s) loaded. Select a friend to send messages.";
        }
        catch(Exception e){feedback.Text="Couldn't load connections: "+e.Message;}
        finally{busy=false;SyncControls();}
    }
    private async Task Add()
    {
        if(busy)return;
        var name=username.Text.Trim().ToLowerInvariant();
        if(!System.Text.RegularExpressions.Regex.IsMatch(name,"^[a-z0-9_]{3,24}$"))
        { feedback.Text="Enter a valid username (3–24 characters)."; return; }
        busy=true; SyncControls();
        try
        {
            await api.SendFriendRequestAsync(name);
            username.Clear(); feedback.Text="Friend request sent to @"+name+".";
        }
        catch(Exception e){feedback.Text="Couldn't send request: "+e.Message;}
        finally{busy=false;SyncControls();}
        await Reload();
    }
    private async Task Respond(bool accepted)
    {
        var idx=requests.SelectedIndex;
        if(busy||idx<0||idx>=items.Count)return;
        var item=items[idx];
        if(item.ToUser!=api.Current?.UserId||item.Status!="pending")return;
        busy=true;SyncControls();
        try {await api.RespondFriendAsync(item.Id,accepted);feedback.Text=accepted?"Friend accepted.":"Request declined.";}
        catch(Exception e){feedback.Text="Couldn't respond: "+e.Message;}
        finally{busy=false;SyncControls();}
        await Reload();
    }
    private async Task OpenDm()
    {
        var idx=requests.SelectedIndex;
        if(busy||idx<0||idx>=items.Count||items[idx].Status!="accepted")return;
        var item=items[idx];
        var other=item.FromUser==api.Current?.UserId ? item.ToUser:item.FromUser;
        try
        {
            var name=await api.FriendUsernameAsync(other);
            using var chat=new DirectMessageForm(api,other,name);
            chat.ShowDialog(this);
        }
        catch(Exception e){feedback.Text="Couldn't open messages: "+e.Message;}
    }
}

internal sealed class DirectMessageForm : Form
{
    private readonly Supabase api;
    private readonly Guid friendId;
    private readonly RichTextBox messages = new() { Dock=DockStyle.Fill, ReadOnly=true,
        ForeColor=Color.White, BackColor=Ui.Background, BorderStyle=BorderStyle.None,
        Font=new Font("Segoe UI",11) };
    private readonly TextBox message=Ui.Input("Private message…");
    private readonly Label feedback=new() { Dock=DockStyle.Fill, ForeColor=Ui.Secondary };
    private readonly Button send=Ui.Button("Send",85);
    private readonly System.Windows.Forms.Timer timer=new() { Interval=15000 };
    private bool loading,sending;
    public DirectMessageForm(Supabase client,Guid target,string username)
    {
        api=client;friendId=target;
        Text="ZuzuCord V2 — @"+username; Size=new Size(750,630);
        MinimumSize=new Size(520,420); StartPosition=FormStartPosition.CenterParent;
        BackColor=Ui.Background; ForeColor=Color.White; Font=Ui.Font;
        var layout=new TableLayoutPanel { Dock=DockStyle.Fill, RowCount=4, Padding=new Padding(18) };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,54));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,56));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,36));
        layout.Controls.Add(new Label { Dock=DockStyle.Fill, Text="DIRECT MESSAGE  /  @"+username,
            ForeColor=Color.White, Font=new Font("Segoe UI Semibold",15), TextAlign=ContentAlignment.MiddleLeft },0,0);
        layout.Controls.Add(messages,0,1);
        var editor=new TableLayoutPanel { Dock=DockStyle.Fill, ColumnCount=2 };
        editor.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        editor.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,100));
        editor.Controls.Add(message,0,0);editor.Controls.Add(send,1,0);
        layout.Controls.Add(editor,0,2);layout.Controls.Add(feedback,0,3);
        Controls.Add(layout);
        Shown += async (_,_) => {await Refresh();timer.Start();};
        timer.Tick += async (_,_) => await Refresh();
        send.Click += async (_,_) => await Send();
        message.KeyDown += async (_,e) => {if(e.KeyCode==Keys.Enter&&!e.Shift){e.SuppressKeyPress=true;await Send();}};
        FormClosed += (_,_)=>{timer.Stop();timer.Dispose();};
    }
    private async Task Refresh()
    {
        if(loading)return;
        loading=true;
        try
        {
            var list=await api.DirectMessagesAsync(friendId);
            var sb=new StringBuilder();
            foreach(var entry in list)
            {
                sb.AppendLine($"[{entry.CreatedAt.ToLocalTime():MMM d, HH:mm}] "+(entry.SenderId==api.Current?.UserId?"You":"Friend"));
                sb.AppendLine(entry.Content);sb.AppendLine();
            }
            var text=sb.Length>0?sb.ToString():"No private messages yet.";
            if(messages.Text!=text){messages.Text=text;messages.SelectionStart=messages.TextLength;messages.ScrollToCaret();}
            feedback.Text="Private conversation · Only accepted friends can read or send messages.";
        }
        catch(Exception e){feedback.Text="Couldn't load DMs: "+e.Message;}
        finally{loading=false;}
    }
    private async Task Send()
    {
        if(sending)return;
        var content=message.Text.Trim();
        if(content.Length is <1 or >2000){feedback.Text="Message must be 1–2000 characters.";return;}
        sending=true;send.Enabled=false;
        try{await api.SendDirectMessageAsync(friendId,content);message.Clear();await Refresh();}
        catch(Exception e){feedback.Text="Couldn't send DM: "+e.Message;}
        finally{sending=false;send.Enabled=true;}
    }
}
