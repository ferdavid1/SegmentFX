# install_extension.ps1

# Enable debug mode
Write-Host "Enabling debug mode for Adobe extensions..."
try {
    New-Item -Path "HKCU:\Software\Adobe\CSXS.11" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1" -Type String
    Write-Host "Debug mode enabled successfully."
}
catch {
    Write-Host "Failed to add registry key. Error: $_"
    exit 1
}

# Copy extension
Write-Host "Copying extension to Adobe CEP extensions folder..."
$extensionName = "SegmentFx"
$sourceDir = Join-Path $PSScriptRoot $extensionName
$destDir = Join-Path $env:CommonProgramFiles(x86) "Adobe\CEP\extensions\$extensionName"

if (-not (Test-Path $sourceDir)) {
    Write-Host "Error: Extension folder not found: $sourceDir"
    exit 1
}

try {
    New-Item -Path (Split-Path $destDir) -ItemType Directory -Force | Out-Null
    Copy-Item -Path $sourceDir -Destination $destDir -Recurse -Force
    Write-Host "Extension copied successfully."
}
catch {
    Write-Host "Failed to copy extension files. Error: $_"
    exit 1
}

Write-Host "Installation complete!"
Write-Host "Please restart any open Adobe applications for the changes to take effect."