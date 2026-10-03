@echo off
setlocal
cd /d "%~dp0"

echo.
echo   EV-Pet - first-run helper
echo   This will install EV-Pet components if needed, then start her.
echo.

where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_npm

if not exist "node_modules\electron\" goto install_packages
if not exist "node_modules\uiohook-napi\" goto install_packages
goto start_pet

:install_packages
echo Installing EV-Pet components. This needs an internet connection and may take a few minutes.
call npm install
if errorlevel 1 goto install_failed

:start_pet
echo Starting EV-Pet. Press Ctrl+Shift+E to open the small interaction panel.
call npm start
if errorlevel 1 echo EV-Pet closed with an error. Keep this window open and share its message for help.
pause
exit /b

:missing_node
echo Node.js is not installed yet. Open the Node.js installer you downloaded, install it, then double-click this file again.
echo If it is already installed, close and reopen this window and try again.
pause
exit /b 1

:missing_npm
echo npm was not found. Reinstall Node.js with its default options, then double-click this file again.
pause
exit /b 1

:install_failed
echo The component download did not finish. Check your internet connection and try again.
echo If it still fails, keep this window open and share the error message for help.
pause
exit /b 1
