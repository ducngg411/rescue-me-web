@echo off
REM Script backup data truoc khi chuyen may
echo ==========================================
echo    BACKUP DU AN RESCUE-ME-WEB
echo ==========================================
echo.

REM Tao thu muc backup voi timestamp
set BACKUP_DATE=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DATE=%BACKUP_DATE: =0%
set BACKUP_DIR=backup_%BACKUP_DATE%

echo Tao thu muc backup: %BACKUP_DIR%
mkdir %BACKUP_DIR%

REM Backup database
echo.
echo [1/4] Backup database...
docker ps | findstr "db" >nul
if errorlevel 1 (
    echo CANH BAO: Docker container khong chay! Hay start docker truoc.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('docker ps --filter "name=db" --format "{{.Names}}"') do set DB_CONTAINER=%%i
echo Container name: %DB_CONTAINER%
docker exec -t %DB_CONTAINER% pg_dump -U app -d rescue > %BACKUP_DIR%\database_backup.sql
if errorlevel 1 (
    echo LOI: Khong the backup database!
) else (
    echo - Database backup thanh cong!
)

REM Backup uploads folder
echo.
echo [2/4] Backup uploads folder...
if exist "backend\uploads" (
    xcopy /E /I /Y backend\uploads %BACKUP_DIR%\uploads >nul
    echo - Uploads backup thanh cong!
) else (
    echo - Khong tim thay thu muc uploads
)

REM Backup .env files
echo.
echo [3/4] Backup environment files...
if exist "backend\.env" (
    copy backend\.env %BACKUP_DIR%\.env.backend >nul
    echo - Backend .env backup thanh cong!
) else (
    echo - Khong tim thay backend\.env
)

if exist "frontend\.env.local" (
    copy frontend\.env.local %BACKUP_DIR%\.env.frontend >nul
    echo - Frontend .env backup thanh cong!
) else (
    echo - Khong tim thay frontend\.env.local
)

REM Create backup info
echo.
echo [4/4] Tao file thong tin backup...
echo Backup created: %date% %time% > %BACKUP_DIR%\backup_info.txt
echo Docker containers: >> %BACKUP_DIR%\backup_info.txt
docker ps >> %BACKUP_DIR%\backup_info.txt

echo.
echo ==========================================
echo BACKUP HOAN TAT!
echo ==========================================
echo Thu muc backup: %BACKUP_DIR%
echo.
echo BUOC TIEP THEO:
echo 1. Commit code: git add . ^&^& git commit -m "Backup" ^&^& git push
echo 2. Copy thu muc '%BACKUP_DIR%' sang laptop moi
echo 3. Chay script restore.bat tren laptop moi
echo ==========================================
pause
