' Open BandUp as an app window without a console (used by the desktop shortcut from `npm run shortcut`).
' Runs scripts\app.mjs from this folder; logs go to data\logs\app-<date>.log.
' node.exe is looked up in the Node.js install folders first: PATH may be stale (e.g. right after installing Node).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

node = "node.exe"
For Each dir In Array("%ProgramFiles%\nodejs", "%ProgramFiles(x86)%\nodejs", "%LOCALAPPDATA%\Programs\nodejs")
  candidate = sh.ExpandEnvironmentStrings(dir) & "\node.exe"
  If fso.FileExists(candidate) Then
    node = candidate
    Exit For
  End If
Next

On Error Resume Next
sh.Run """" & node & """ scripts\app.mjs", 0, False
If Err.Number <> 0 Then
  MsgBox "BandUp: khong chay duoc Node.js (" & node & ")." & vbCrLf & _
         "Cai Node.js 20 roi mo lai BandUp." & vbCrLf & vbCrLf & Err.Description, vbCritical, "BandUp"
End If
