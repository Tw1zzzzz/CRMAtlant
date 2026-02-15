@echo off
echo ========================================
echo   Docker WSL2 Virtualization Fix
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

echo 🔍 Диагностика виртуализации и WSL2...

echo.
echo 📋 Проверяем текущее состояние компонентов Windows...

echo Проверяем Windows Subsystem for Linux...
dism.exe /online /get-features /featurename:Microsoft-Windows-Subsystem-Linux | findstr "State"

echo Проверяем Virtual Machine Platform...
dism.exe /online /get-features /featurename:VirtualMachinePlatform | findstr "State"

echo Проверяем Hyper-V...
dism.exe /online /get-features /featurename:Microsoft-Hyper-V-All | findstr "State"

echo Проверяем Windows Hypervisor Platform...
dism.exe /online /get-features /featurename:HypervisorPlatform | findstr "State"

echo Проверяем Containers...
dism.exe /online /get-features /featurename:Containers | findstr "State"

echo.
echo 🔧 Включаем все необходимые компоненты...

echo 1. Включаем Windows Subsystem for Linux...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

echo 2. Включаем Virtual Machine Platform...
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

echo 3. Включаем Windows Hypervisor Platform...
dism.exe /online /enable-feature /featurename:HypervisorPlatform /all /norestart

echo 4. Включаем Containers...
dism.exe /online /enable-feature /featurename:Containers /all /norestart

echo 5. Включаем Hyper-V (если доступен)...
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart

echo.
echo 🛑 Останавливаем все сервисы...
net stop vmms >nul 2>&1
net stop vmcompute >nul 2>&1
wsl --shutdown >nul 2>&1

echo.
echo ▶️  Запускаем сервисы виртуализации...
net start vmcompute
net start vmms

echo.
echo 🔄 Настраиваем WSL...
wsl --set-default-version 2
wsl --update --web-download

echo.
echo 🔍 Проверяем результат...
echo WSL статус:
wsl --status

echo.
echo Сервисы виртуализации:
sc query vmcompute | findstr "STATE"
sc query vmms | findstr "STATE"

echo.
echo ⚠️  КРИТИЧЕСКИ ВАЖНО:
echo ═══════════════════════
echo 1. ОБЯЗАТЕЛЬНО ПЕРЕЗАГРУЗИТЕ КОМПЬЮТЕР после выполнения этого скрипта
echo 2. После перезагрузки убедитесь, что в BIOS включена виртуализация:
echo    - Intel: Intel VT-x или Intel Virtualization Technology
echo    - AMD: AMD-V или SVM Mode
echo 3. Затем запустите Docker Desktop
echo.

echo 📋 Дополнительная диагностика:
echo ═══════════════════════════════
echo Если проблема останется, проверьте:
echo.
echo 1. Виртуализация в BIOS (ОБЯЗАТЕЛЬНО!):
echo    - Перезагрузитесь и войдите в BIOS (F2, F12, Delete)
echo    - Найдите настройки виртуализации
echo    - Включите Intel VT-x/AMD-V
echo.
echo 2. Антивирус и защита:
echo    - Отключите временно сторонний антивирус
echo    - Проверьте Windows Defender Application Guard
echo.
echo 3. Конфликты программ:
echo    - VirtualBox (может конфликтовать)
echo    - VMware Workstation
echo    - Другие программы виртуализации
echo.

pause

echo.
echo 🔄 Рекомендуется перезагрузка СЕЙЧАС!
set /p restart="Перезагрузить компьютер сейчас? (y/n): "
if /i "%restart%"=="y" (
    echo Перезагружаем...
    shutdown /r /t 10 /c "Перезагрузка для применения изменений виртуализации"
    echo Компьютер перезагрузится через 10 секунд...
) else (
    echo Не забудьте перезагрузить компьютер вручную!
)

pause 