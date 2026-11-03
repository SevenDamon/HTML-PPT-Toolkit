using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace HtmlPptToolkitLauncher
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ToolkitForm());
        }
    }

    internal sealed class ToolkitForm : Form
    {
        private readonly string toolkitRoot;
        private readonly string pwshPath;
        private readonly string version;
        private readonly Label status;

        internal ToolkitForm()
        {
            toolkitRoot = AppDomain.CurrentDomain.BaseDirectory;
            pwshPath = ResolvePwsh();
            version = ReadVersion(toolkitRoot);
            Text = "HTML PPT 工具箱 · v" + version;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(620, 470);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            BackColor = Color.White;
            Font = new Font("Microsoft YaHei UI", 10F);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            Controls.Add(NewLabel("HTML PPT 工具箱", 28, 22, 400, 42, 22F, FontStyle.Bold, Color.FromArgb(23, 48, 71)));
            Label versionLabel = NewLabel("v" + version, 480, 29, 110, 28, 10F, FontStyle.Bold, Color.FromArgb(215, 100, 50));
            versionLabel.TextAlign = ContentAlignment.MiddleRight;
            Controls.Add(versionLabel);
            Controls.Add(NewLabel("选择任务，开始编辑或导出 HTML PPT。", 31, 67, 355, 26, 10F, FontStyle.Regular, Color.FromArgb(91, 108, 121)));
            Button helpButton = new Button();
            helpButton.Location = new Point(398, 62);
            helpButton.Size = new Size(112, 31);
            helpButton.Text = "使用说明";
            helpButton.FlatStyle = FlatStyle.Flat;
            helpButton.FlatAppearance.BorderColor = Color.FromArgb(63, 133, 136);
            helpButton.ForeColor = Color.FromArgb(23, 48, 71);
            helpButton.BackColor = Color.White;
            helpButton.Cursor = Cursors.Hand;
            helpButton.Click += delegate { ShowHelp(); };
            Controls.Add(helpButton);
            Button aboutButton = new Button();
            aboutButton.Name = "aboutButton";
            aboutButton.Location = new Point(520, 62);
            aboutButton.Size = new Size(70, 31);
            aboutButton.Text = "关于";
            aboutButton.FlatStyle = FlatStyle.Flat;
            aboutButton.FlatAppearance.BorderColor = Color.FromArgb(203, 220, 212);
            aboutButton.ForeColor = Color.FromArgb(23, 48, 71);
            aboutButton.BackColor = Color.White;
            aboutButton.Cursor = Cursors.Hand;
            aboutButton.Click += delegate { using (Form about = CreateAboutForm()) about.ShowDialog(this); };
            Controls.Add(aboutButton);

            AddAction(105, "快速接入编辑器", "生成 Lite 编辑版，可编辑及另存 HTML。复杂网页建议由 Skill + Agent 适配结构。", "convert-html.ps1");
            AddAction(205, "打开课件 · 保存与导出", "打开已接入编辑器的课件，启用源 HTML 保存及 PDF/PPTX 导出，不重复安装工具栏。", "start-studio.ps1");
            AddAction(305, "获取 Skill", "打开 GitHub 的 Skill 页面，按说明安装到 Agent，用于新建或深度适配旧网页。", "https://github.com/SevenDamon/codexskill/tree/main/html-ppt-author");

            status = NewLabel("准备就绪", 31, 424, 550, 24, 9F, FontStyle.Regular, Color.FromArgb(91, 108, 121));
            Controls.Add(status);
        }

        private void AddAction(int top, string title, string description, string script)
        {
            Panel panel = new Panel();
            panel.Location = new Point(28, top);
            panel.Size = new Size(564, 84);
            panel.BackColor = Color.FromArgb(244, 247, 249);

            Button button = new Button();
            button.Location = new Point(14, 13);
            button.Size = new Size(205, 58);
            button.Text = title;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0;
            button.BackColor = Color.FromArgb(23, 48, 71);
            button.ForeColor = Color.White;
            button.Font = new Font("Microsoft YaHei UI", 10.5F, FontStyle.Bold);
            button.Cursor = Cursors.Hand;
            button.Click += delegate { LaunchScript(script, title); };

            Label note = NewLabel(description, 238, 18, 308, 50, 9.5F, FontStyle.Regular, Color.FromArgb(61, 78, 92));
            panel.Controls.Add(button);
            panel.Controls.Add(note);
            Controls.Add(panel);
        }

        private void LaunchScript(string scriptName, string actionName)
        {
            if (scriptName.StartsWith("https://github.com/", StringComparison.Ordinal))
            {
                try { Process.Start(new ProcessStartInfo(scriptName) { UseShellExecute = true }); status.Text = "已打开 Skill 获取页面；请按页面说明安装。"; }
                catch (Exception error) { MessageBox.Show("无法打开浏览器：\n" + error.Message); }
                return;
            }
            string scriptPath = Path.Combine(toolkitRoot, scriptName);
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show("找不到功能脚本：\n" + scriptPath, "HTML PPT 工具箱", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            if (String.IsNullOrEmpty(pwshPath))
            {
                MessageBox.Show("未找到可用的 PowerShell。请恢复 Windows 自带的 Windows PowerShell，或安装 PowerShell 7；无需安装 Codex。", "HTML PPT 工具箱", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            try
            {
                ProcessStartInfo info = new ProcessStartInfo();
                info.FileName = pwshPath;
                info.Arguments = "-NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File \"" + scriptPath + "\"";
                info.WorkingDirectory = toolkitRoot;
                info.UseShellExecute = true;
                Process.Start(info);
                status.Text = "已启动：" + actionName;
            }
            catch (Exception error)
            {
                MessageBox.Show("启动失败：\n" + error.Message, "HTML PPT 工具箱", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void ShowHelp()
        {
            Form help = new Form();
            help.Text = "使用说明 · v" + version;
            help.StartPosition = FormStartPosition.CenterParent;
            help.ClientSize = new Size(720, 632);
            help.FormBorderStyle = FormBorderStyle.FixedDialog;
            help.MaximizeBox = false;
            help.MinimizeBox = false;
            help.BackColor = Color.White;
            help.Font = new Font("Microsoft YaHei UI", 10F);
            try { help.Icon = Icon; } catch { }
            help.Controls.Add(NewLabel("三者分别解决什么问题？", 28, 22, 560, 38, 19F, FontStyle.Bold, Color.FromArgb(23, 48, 71)));
            help.Controls.Add(NewLabel("先记住下面三句话，再按使用场景选择。", 31, 61, 620, 25, 10F, FontStyle.Regular, Color.FromArgb(91, 108, 121)));
            AddHelpSection(help, 98, "1  快速接入编辑器 · Lite", Color.FromArgb(63, 133, 136), "保留原文件，生成带工具栏的新 HTML。可以编辑、另存 HTML；不含源文件写回及 PDF/PPTX。复杂结构交给 Skill + Agent 适配。");
            AddHelpSection(help, 208, "2  打开课件 · 保存与导出", Color.FromArgb(215, 100, 50), "打开已有编辑器的 HTML，启用 Full 保存和导出服务；不会重复接入编辑器。覆盖源文件前自动备份，关闭后台后服务停止。");
            AddHelpSection(help, 318, "3  获取 Skill · GitHub", Color.FromArgb(23, 48, 71), "打开 html-ppt-author 仓库页面，按说明安装。配合 Agent 新建或适配旧 HTML。跳转页面不代表已经自动安装。");
            Panel choice = new Panel();
            choice.Location = new Point(28, 438);
            choice.Size = new Size(664, 112);
            choice.BackColor = Color.FromArgb(245, 239, 227);
            choice.Controls.Add(NewLabel("怎么选", 18, 13, 120, 27, 11F, FontStyle.Bold, Color.FromArgb(23, 48, 71)));
            choice.Controls.Add(NewLabel("快速试用旧网页 → 接入 Lite    新建或深度适配 → Skill + Agent\n已有 Lite / Full 课件 → 保存与导出    Full 不会修复结构问题", 18, 43, 625, 56, 10F, FontStyle.Regular, Color.FromArgb(61, 78, 92)));
            help.Controls.Add(choice);
            help.Controls.Add(NewLabel("导出完整版已含 Node.js 和转换引擎，无需 Codex；请完整解压。\n导出使用包内浏览器。源码包需另行配置运行时与转换引擎。", 31, 565, 660, 49, 9F, FontStyle.Regular, Color.FromArgb(91, 108, 121)));
            help.ShowDialog(this);
        }

        private Form CreateAboutForm()
        {
            Form about = new Form();
            about.Text = "关于 · HTML PPT 工具箱";
            about.StartPosition = FormStartPosition.CenterParent;
            about.ClientSize = new Size(620, 550);
            about.FormBorderStyle = FormBorderStyle.FixedDialog;
            about.MaximizeBox = false;
            about.MinimizeBox = false;
            about.BackColor = Color.FromArgb(247, 250, 248);
            about.Font = new Font("Microsoft YaHei UI", 10F);
            try { about.Icon = Icon; } catch { }
            about.Controls.Add(NewLabel("关于 HTML PPT 工具箱", 28, 22, 560, 38, 20F, FontStyle.Bold, Color.FromArgb(23, 48, 71)));
            about.Controls.Add(NewLabel("作者：躬行者", 31, 76, 550, 28, 12F, FontStyle.Bold, Color.FromArgb(40, 124, 104)));
            about.Controls.Add(NewLabel("全网统一昵称：科学老师学AI", 31, 112, 550, 26, 10.5F, FontStyle.Regular, Color.FromArgb(91, 108, 121)));
            AddQrCard(about, 28, "微信二维码", "扫码添加微信", "HtmlPptToolkit.AuthorWechatQr.png");
            AddQrCard(about, 322, "公众号二维码", "扫码关注公众号", "HtmlPptToolkit.AuthorOfficialAccountQr.jpg");
            about.Controls.Add(NewLabel("HTML PPT Toolkit · v" + version, 31, 491, 390, 26, 9F, FontStyle.Regular, Color.FromArgb(91, 108, 121)));
            Button close = new Button();
            close.Text = "关闭";
            close.Location = new Point(510, 486);
            close.Size = new Size(82, 34);
            close.FlatStyle = FlatStyle.Flat;
            close.FlatAppearance.BorderSize = 0;
            close.BackColor = Color.FromArgb(40, 124, 104);
            close.ForeColor = Color.White;
            close.Cursor = Cursors.Hand;
            close.DialogResult = DialogResult.OK;
            about.Controls.Add(close);
            about.AcceptButton = close;
            about.CancelButton = close;
            return about;
        }

        private static void AddQrCard(Form form, int left, string title, string caption, string resource)
        {
            Panel card = new Panel();
            card.Location = new Point(left, 158);
            card.Size = new Size(270, 302);
            card.BackColor = Color.White;
            Label heading = NewLabel(title, 15, 13, 240, 26, 11F, FontStyle.Bold, Color.FromArgb(23, 48, 71));
            heading.TextAlign = ContentAlignment.MiddleCenter;
            card.Controls.Add(heading);
            PictureBox image = new PictureBox();
            image.Name = resource;
            image.Location = new Point(25, 48);
            image.Size = new Size(220, 220);
            image.BackColor = Color.White;
            image.SizeMode = PictureBoxSizeMode.Zoom;
            using (Stream stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
            {
                if (stream != null) using (Image original = Image.FromStream(stream)) image.Image = new Bitmap(original);
            }
            image.Disposed += delegate { if (image.Image != null) image.Image.Dispose(); };
            card.Controls.Add(image);
            Label note = NewLabel(caption, 15, 272, 240, 22, 9F, FontStyle.Regular, Color.FromArgb(91, 108, 121));
            note.TextAlign = ContentAlignment.MiddleCenter;
            card.Controls.Add(note);
            form.Controls.Add(card);
        }

        private static void AddHelpSection(Form form, int top, string title, Color accent, string description)
        {
            Panel panel = new Panel();
            panel.Location = new Point(28, top);
            panel.Size = new Size(664, 94);
            panel.BackColor = Color.FromArgb(244, 247, 249);
            Panel bar = new Panel();
            bar.Location = new Point(0, 0);
            bar.Size = new Size(7, 94);
            bar.BackColor = accent;
            panel.Controls.Add(bar);
            panel.Controls.Add(NewLabel(title, 22, 12, 610, 28, 11F, FontStyle.Bold, Color.FromArgb(23, 48, 71)));
            panel.Controls.Add(NewLabel(description, 22, 43, 615, 43, 9.5F, FontStyle.Regular, Color.FromArgb(61, 78, 92)));
            form.Controls.Add(panel);
        }

        private static string ResolvePwsh()
        {
            string pathValue = Environment.GetEnvironmentVariable("PATH") ?? String.Empty;
            foreach (string directory in pathValue.Split(Path.PathSeparator))
            {
                try
                {
                    string candidate = Path.Combine(directory.Trim(), "pwsh.exe");
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }
            string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            string builtIn = Path.Combine(windows, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
            if (File.Exists(builtIn)) return builtIn;
            string bundled = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "powershell", "pwsh.exe");
            if (File.Exists(bundled)) return bundled;
            return null;
        }

        private static string ReadVersion(string root)
        {
            try
            {
                string json = File.ReadAllText(Path.Combine(root, "package.json"));
                Match match = Regex.Match(json, "\\\"version\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
                if (match.Success) return match.Groups[1].Value;
            }
            catch { }
            return "unknown";
        }

        private static Label NewLabel(string text, int left, int top, int width, int height, float size, FontStyle style, Color color)
        {
            Label label = new Label();
            label.Text = text;
            label.Location = new Point(left, top);
            label.Size = new Size(width, height);
            label.Font = new Font("Microsoft YaHei UI", size, style);
            label.ForeColor = color;
            return label;
        }
    }
}
