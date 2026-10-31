// npm run shortcut — put a "BandUp" shortcut with the logo on the Desktop (Windows). It opens BandUp.vbs,
// which starts BandUp hidden and shows it as an app window. Pin it to the taskbar from its right-click menu.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './lib.mjs';

if (process.platform !== 'win32') {
  console.error('Lệnh này chỉ dùng trên Windows.');
  process.exit(1);
}

const script = [
  '$desk = [Environment]::GetFolderPath("Desktop")',
  '$lnk = Join-Path $desk "BandUp.lnk"',
  '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)',
  '$s.TargetPath = Join-Path $env:SystemRoot "System32\\wscript.exe"',
  '$s.Arguments = "`"" + $env:BANDUP_VBS + "`""',
  '$s.WorkingDirectory = $env:BANDUP_ROOT',
  '$s.IconLocation = $env:BANDUP_ICO + ",0"',
  '$s.Description = "BandUp — Luyện thi IELTS"',
  '$s.Save()',
  'Write-Output $lnk',
].join('; ');

const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
  env: {
    ...process.env,
    BANDUP_ROOT: ROOT,
    BANDUP_VBS: path.join(ROOT, 'BandUp.vbs'),
    BANDUP_ICO: path.join(ROOT, 'BandUp.ico'),
  },
  encoding: 'utf8',
});
if (res.status !== 0) {
  console.error(res.stderr || 'Không tạo được shortcut.');
  process.exit(1);
}
console.log(`Đã tạo shortcut: ${res.stdout.trim()}`);
