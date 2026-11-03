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
            Controls.Add(NewLabel("只需要记住这一个入口。选择任务后，工具会打开对应窗口。", 31, 67, 425, 26, 10F, FontStyle.Regular, Color.FromArgb(91, 108, 121)));
            Button helpButton = new Button();
            helpButton.Location = new Point(478, 62);
            helpButton.Size = new Size(112, 31);
            helpButton.Text = "使用说明";
            helpButton.FlatStyle = FlatStyle.Flat;
            helpButton.FlatAppearance.BorderColor = Color.FromArgb(63, 133, 136);
            helpButton.ForeColor = Color.FromArgb(23, 48, 71);
            helpButton.BackColor = Color.White;
            helpButton.Cursor = Cursors.Hand;
            helpButton.Click += delegate { ShowHelp(); };
            Controls.Add(helpButton);

            AddAction(105, "转换为 Full 编辑版", "处理已有或外部 HTML；保留原文件并生成完整编辑版。", "convert-html.ps1");
            AddAction(205, "打开 HTML PPT 工作台", "编辑 Full HTML，保存源文件，并导出 PDF 或可编辑 PPTX。", "start-studio.ps1");
            AddAction(305, "构建并同步 Skill", "核心升级后使用；重建并安装 html-ppt-author Skill。", "build-and-sync-skill.ps1");

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
            AddHelpSection(help, 98, "1  html-ppt-author Skill", Color.FromArgb(63, 133, 136), "给 Agent 的制作规范和便携编辑器。用于从大纲制作新 PPT 或由 Agent 改造旧 PPT。默认 Lite；Skill 本身不提供 PDF/PPTX 后台。");
            AddHelpSection(help, 208, "2  转换为 Full 编辑版", Color.FromArgb(215, 100, 50), "把工具栏永久安装到 HTML。以后直接双击 HTML 也能编辑；移动时要连同 html-ppt-editor 文件夹一起带走。");
            AddHelpSection(help, 318, "3  HTML PPT 工作台", Color.FromArgb(23, 48, 71), "临时给网页外挂工具栏，并提供保存源文件、PDF 和 PPTX。普通 HTML 只用工作台编辑，保存后仍不会永久带工具栏。");
            Panel choice = new Panel();
            choice.Location = new Point(28, 438);
            choice.Size = new Size(664, 112);
            choice.BackColor = Color.FromArgb(245, 239, 227);
            choice.Controls.Add(NewLabel("怎么选", 18, 13, 120, 27, 11F, FontStyle.Bold, Color.FromArgb(23, 48, 71)));
            choice.Controls.Add(NewLabel("Agent 新做 → Skill    普通 HTML 永久带工具栏 → 转换 Full\n只想编辑或导出 → 工作台    已是最新版 Full → 直接进工作台", 18, 43, 625, 56, 10F, FontStyle.Regular, Color.FromArgb(61, 78, 92)));
            help.Controls.Add(choice);
            help.Controls.Add(NewLabel("导出完整版已含 Node.js 和转换引擎，无需 Codex；请完整解压。\n导出使用包内浏览器。源码包需另行配置运行时与转换引擎。", 31, 565, 660, 49, 9F, FontStyle.Regular, Color.FromArgb(91, 108, 121)));
            help.ShowDialog(this);
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
