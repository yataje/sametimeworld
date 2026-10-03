$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
Push-Location -LiteralPath $here
try {
    New-Item -ItemType Directory -Path 'build' -Force | Out-Null
    if (!(Test-Path -LiteralPath 'LocalSave.cs')) { throw "Missing installer source in $here" }
    $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    Write-Output "Compiling installer from $(Get-Location)"
    & $csc /nologo /target:winexe /platform:anycpu /optimize+ /out:build\SameTimeWorld_LocalSave.stub.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:System.Web.Extensions.dll LocalSave.cs
    if ($LASTEXITCODE -ne 0) { throw 'C# compilation failed' }
    python test_installer.py
    if ($LASTEXITCODE -ne 0) { throw 'Windows backup/installer checks failed' }
} finally { Pop-Location }
