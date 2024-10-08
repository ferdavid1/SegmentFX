# install_extension.ps1

# Function to check if debug mode is enabled
function Is-DebugModeEnabled {
    $regPath = "HKCU:\Software\Adobe\CSXS.11"
    $regName = "PlayerDebugMode"
    if (Test-Path $regPath) {
        $value = Get-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue
        return ($value -ne $null -and $value.PlayerDebugMode -eq "1")
    }
    $secondregPath = "HKCU:\Software\Adobe\CSXS.8"
    if (Test-Path $secondregPath) {
        $value = Get-ItemProperty -Path $secondregPath -Name $regName -ErrorAction SilentlyContinue
        return ($value -ne $null -and $value.PlayerDebugMode -eq "1")
    }
    return $false
}

# Enable debug mode
Write-Host "Checking Adobe extension debug mode..."
if (Is-DebugModeEnabled) {
    Write-Host "Debug mode is already enabled."
}
else {
    Write-Host "Enabling debug mode for Adobe extensions..."
    try {
        if (-not (Test-Path "HKCU:\Software\Adobe\CSXS.8")) {
            New-Item -Path "HKCU:\Software\Adobe\CSXS.8" -Force | Out-Null
        }
        Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.8" -Name "PlayerDebugMode" -Value "1" -Type String

        if (-not (Test-Path "HKCU:\Software\Adobe\CSXS.8")) {
            New-Item -Path "HKCU:\Software\Adobe\CSXS.11" -Force | Out-Null
        }
        Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1" -Type String
        Write-Host "Debug mode enabled successfully."
    }
    catch {
        Write-Host "Failed to add registry key. Error: $_"
        exit 1
    }
}

# Copy extension
Write-Host "Checking for existing extension installation..."
$extensionName = "SegmentFx"
$sourceDir = Join-Path $PSScriptRoot "../../"
$commonFilesPath = ${Env:ProgramFiles}
$destDir = Join-Path $commonFilesPath "Adobe\Adobe Premiere Pro CC 2018\CEP\extensions\$extensionName"

if (-not (Test-Path $sourceDir)) {
    Write-Host "Error: Extension folder not found: $sourceDir"
    exit 1
}

if (Test-Path $destDir) {
    $choice = Read-Host "Extension is already installed. Do you want to reinstall? (Y/N)"
    if ($choice -eq "Y" -or $choice -eq "y") {
        Write-Host "Removing existing installation..."
        Remove-Item -Path $destDir -Recurse -Force
    } else {
        Write-Host "Installation cancelled."
        exit 0
    }
}

Write-Host "Copying extension to Adobe CEP extensions folder..."
try {
    New-Item -Path (Split-Path $destDir) -ItemType Directory -Force | Out-Null
    Copy-Item -Path $sourceDir -Destination $destDir -Recurse -Force

    # Create logs directory and empty log file
    $logsDir = Join-Path $destDir "logs"
    New-Item -Path $logsDir -ItemType Directory -Force | Out-Null
    $logFile = Join-Path $logsDir "adobe_cep_logs.txt"
    New-Item -Path $logFile -ItemType File -Force | Out-Null
    
    # Set permissions to allow writing
    $acl = Get-Acl $logsDir
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Users","Modify","Allow")
    $acl.SetAccessRule($rule)
    Set-Acl $logsDir $acl
    Set-Acl $logFile $acl
    
    Write-Host "Extension copied successfully."
    Write-Host "Logs directory and file created with write permissions."
}
catch {
    Write-Host "Failed to copy extension files. Error: $_"
    exit 1
}

Write-Host "Installation complete!"
Write-Host "Please restart any open Adobe applications for the changes to take effect."