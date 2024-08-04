@echo off
echo Enabling debug mode for Adobe extensions...
REG ADD "HKEY_CURRENT_USER\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_STRING /d 1 /f
if %errorlevel% neq 0 (
    echo Failed to add registry key. Please run this script as administrator.
    pause
    exit /b 1
)

echo Copying extension to Adobe CEP extensions folder...
set "EXTENSION_NAME=SegmentFx"
set "SOURCE_DIR=%~dp0%EXTENSION_NAME%"
set "DEST_DIR=%CommonProgramFiles(x86)%\Adobe\CEP\extensions\%EXTENSION_NAME%"

if not exist "%SOURCE_DIR%" (
    echo Error: Extension folder not found: %SOURCE_DIR%
    pause
    exit /b 1
)

if not exist "%CommonProgramFiles(x86)%\Adobe\CEP\extensions" mkdir "%CommonProgramFiles(x86)%\Adobe\CEP\extensions"
xcopy /E /I /Y "%SOURCE_DIR%" "%DEST_DIR%"
if %errorlevel% neq 0 (
    echo Failed to copy extension files. Please run this script as administrator.
    pause
    exit /b 1
)

echo Installation complete!
echo Please restart any open Adobe applications for the changes to take effect.
pause