@echo off
echo Enabling debug mode for Adobe extensions...
REG ADD HKEY_CURRENT_USER\Software\Adobe\CSXS.11 /v PlayerDebugMode /t REG_STRING /d 1 /f

echo Copying extension to Adobe CEP extensions folder...
if not exist "%CommonProgramFiles(x86)%\Adobe\CEP\extensions" mkdir "%CommonProgramFiles(x86)%\Adobe\CEP\extensions"
xcopy /E /I /Y "%~dp0YourExtension" "%CommonProgramFiles(x86)%\Adobe\CEP\extensions\YourExtension"

echo Installation complete!
echo Please restart any open Adobe applications for the changes to take effect.
pause