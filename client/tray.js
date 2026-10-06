// Icône discrète dans la barre des tâches Windows (system tray), via un petit
// script PowerShell embarqué (NotifyIcon .NET) — aucun module natif, aucune
// fenêtre. Un clic ouvre la page d'état d'ARCHI Link dans le navigateur.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Icône ICO 16x16 (accent ARCHI) — remplaçable par assets/logo plus tard.
const ICON_B64 = 'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAAAADMuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/zLhM/8y4TP/MuEz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

const PS = (url, iconPath, appName) => `
\$ErrorActionPreference='SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
\$ni = New-Object System.Windows.Forms.NotifyIcon
try { \$ni.Icon = New-Object System.Drawing.Icon('${iconPath}') } catch { \$ni.Icon = [System.Drawing.SystemIcons]::Application }
\$ni.Text = '${appName}'
\$ni.Visible = \$true
\$menu = New-Object System.Windows.Forms.ContextMenuStrip
\$o = \$menu.Items.Add('Ouvrir ${appName}');     \$o.add_Click({ Start-Process '${url}' })
\$c = \$menu.Items.Add('Configuration...');       \$c.add_Click({ Start-Process '${url}?setup=1' })
[void]\$menu.Items.Add('-')
\$q = \$menu.Items.Add('Quitter');                \$q.add_Click({ try { Invoke-WebRequest -UseBasicParsing '${url}api/quit' -TimeoutSec 2 } catch {}; \$ni.Visible=\$false; [System.Windows.Forms.Application]::Exit() })
\$ni.ContextMenuStrip = \$menu
\$ni.add_MouseClick({ param(\$s,\$e) if (\$e.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Start-Process '${url}' } })
\$ni.ShowBalloonTip(2500, '${appName}', 'Actif en fond. Clique ici pour voir l''etat.', [System.Windows.Forms.ToolTipIcon]::Info)
[System.Windows.Forms.Application]::Run()
`;

// Lance le tray. opts : { dir, appName }. Retourne le process (ou null).
function start(url, opts) {
  if (process.platform !== 'win32') return null;   // tray = Windows uniquement
  opts = opts || {};
  const dir = opts.dir || process.cwd();
  const appName = opts.appName || 'ARCHI Link';
  const iconPath = path.join(dir, 'icon.ico');
  const ps1Path = path.join(dir, 'tray.ps1');
  try {
    fs.writeFileSync(iconPath, Buffer.from(ICON_B64, 'base64'));
    fs.writeFileSync(ps1Path, PS(url, iconPath.replace(/\\/g, '\\\\'), appName));
  } catch (e) { return null; }
  try {
    const p = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', ps1Path],
      { windowsHide: true, stdio: 'ignore' });
    return p;
  } catch (e) { return null; }
}

module.exports = { start };
