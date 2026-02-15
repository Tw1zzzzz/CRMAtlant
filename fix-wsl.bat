@echo off
echo ========================================
echo     WSL Update Fix Tool
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Этот скрипт должен быть запущен от имени администратора
    echo Щелкните правой кнопкой мыши на файл и выберите "Запуск от имени администратора"
    pause
    exit /b 1
)

echo 🔍 Диагностика WSL...

echo.
echo 📋 Проверяем функции Windows...
dism.exe /online /get-features /featurename:Microsoft-Windows-Subsystem-Linux
echo.
dism.exe /online /get-features /featurename:VirtualMachinePlatform

echo.
echo 🔧 Исправляем проблемы с WSL...

echo 1. Включаем Windows Subsystem for Linux...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

echo 2. Включаем Virtual Machine Platform...
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

echo 3. Останавливаем WSL...
wsl --shutdown

echo 4. Устанавливаем WSL 2 как версию по умолчанию...
wsl --set-default-version 2

echo.
echo 🔄 Пробуем различные способы обновления WSL...

echo Способ 1: Обычное обновление
wsl --update --web-download

if %errorlevel% neq 0 (
    echo Способ 2: Обновление с веб-загрузкой
    wsl --update --web-download
)

if %errorlevel% neq 0 (
    echo Способ 3: Обновление встроенного ядра
    wsl --update --inbox
)

if %errorlevel% neq 0 (
    echo.
    echo 📥 Автоматическое обновление не удалось. Устанавливаем через winget...
    winget install Microsoft.WSL --accept-source-agreements --accept-package-agreements
)

echo.
echo 🔍 Проверяем статус после исправлений...
wsl --status

echo.
echo ⚠️  ВАЖНО: Если были включены новые функции Windows, требуется ПЕРЕЗАГРУЗКА!
echo.
echo После перезагрузки:
echo 1. Запустите этот скрипт снова
echo 2. Или попробуйте: wsl --update --web-download
echo.

echo 🛠️  Дополнительные команды для диагностики:
echo   wsl --status           - статус WSL
echo   wsl --list --verbose   - список дистрибутивов
echo   wsl --update           - обновление WSL
echo.

pause 