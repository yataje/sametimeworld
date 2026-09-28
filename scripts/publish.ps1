param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$task=if($CheckOnly){'--build'}else{'--publish'}
if(Get-Command py -ErrorAction SilentlyContinue){ & py -3 '_local/tools/manager.py' $task }else{ & python '_local/tools/manager.py' $task }
exit $LASTEXITCODE
