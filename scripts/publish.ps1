param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Run-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}
try {
    $branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Publish must run on the main branch.' }
    $staged = & git diff --cached --name-only
    if ($staged) { throw 'There are already staged changes. Review them before publishing.' }
    if (!(Test-Path 'node_modules')) { Run-Checked npm.cmd @('ci') }
    Run-Checked npm.cmd @('test')
    Run-Checked npm.cmd @('run','build')
    if ($CheckOnly) { Write-Host '[OK] Ready to publish.'; exit 0 }
    $paths = @('index.html','src','tests','scripts','package.json','package-lock.json','vite.config.js','README.md','.gitignore','.github','Build_Web.cmd','Start_Dev_Server.cmd','Publish_GitHub.cmd')
    Run-Checked git (@('add','--') + $paths)
    # Retired HTML snapshots are the only deletions outside the source paths.
    $removed = & git ls-files --deleted -- 'index.before-init-fix.html' 'index.before-ui-patch.html' 'index.before-v0.3.17.html'
    foreach ($path in $removed) { Run-Checked git @('add','--',$path) }
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) { Run-Checked git @('commit','-m','Maintain events-only viewer and verified publishing') }
    elseif ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged changes.' }
    Run-Checked git @('push','origin','main')
    Write-Host '[OK] Push succeeded. GitHub Actions must finish before the website is updated.'
    Write-Host 'https://github.com/yataje/sametimeworld/actions'
} catch { Write-Host "[ERROR] $($_.Exception.Message)"; exit 1 }
