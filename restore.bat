@echo off
REM Script restore data tren may moi
echo ==========================================
echo    RESTORE DU AN RESCUE-ME-WEB
echo ==========================================
echo.

REM Tim thu muc backup
set BACKUP_DIR=
for /d %%i in (backup_*) do set BACKUP_DIR=%%i

if "%BACKUP_DIR%"=="" (
    echo LOI: Khong tim thay thu muc backup!
    echo Hay copy thu muc backup tu may cu sang day.
    pause
    exit /b 1
)

echo Su dung thu muc backup: %BACKUP_DIR%
echo.

REM Check Docker
echo Kiem tra Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo LOI: Docker khong chay! Hay start Docker Desktop.
    pause
    exit /b 1
)

REM Start docker-compose
echo.
echo [1/5] Khoi dong Docker services...
docker-compose up -d
timeout /t 10 /nobreak >nul
echo - Docker services da khoi dong!

REM Restore environment files
echo.
echo [2/5] Restore environment files...
if exist "%BACKUP_DIR%\.env.backend" (
    copy %BACKUP_DIR%\.env.backend backend\.env >nul
    echo - Backend .env restored!
) else (
    echo - Khong tim thay .env.backend trong backup
)

if exist "%BACKUP_DIR%\.env.frontend" (
    copy %BACKUP_DIR%\.env.frontend frontend\.env.local >nul
    echo - Frontend .env restored!
) else (
    echo - Khong tim thay .env.frontend trong backup
)

REM Restore database
echo.
echo [3/5] Restore database...
for /f "tokens=*" %%i in ('docker ps --filter "name=db" --format "{{.Names}}"') do set DB_CONTAINER=%%i
echo Container name: %DB_CONTAINER%

REM Drop va recreate database
docker exec -i %DB_CONTAINER% psql -U app -c "DROP DATABASE IF EXISTS rescue;" >nul 2>&1
docker exec -i %DB_CONTAINER% psql -U app -c "CREATE DATABASE rescue;" >nul
docker exec -i %DB_CONTAINER% psql -U app -d rescue < %BACKUP_DIR%\database_backup.sql >nul
if errorlevel 1 (
    echo LOI: Khong the restore database!
    echo Thu restore thu cong: docker exec -i %DB_CONTAINER% psql -U app -d rescue ^< %BACKUP_DIR%\database_backup.sql
) else (
    echo - Database restored thanh cong!
)

REM Restore uploads
echo.
echo [4/5] Restore uploads folder...
if exist "%BACKUP_DIR%\uploads" (
    if not exist "backend\uploads" mkdir backend\uploads
    xcopy /E /I /Y %BACKUP_DIR%\uploads backend\uploads >nul
    echo - Uploads restored thanh cong!
) else (
    echo - Khong tim thay thu muc uploads trong backup
)

REM Install dependencies
echo.
echo [5/5] Cai dat dependencies...
echo.
echo === BACKEND ===
cd backend
call npm install
call npx prisma generate
cd ..
echo.
echo === FRONTEND ===
cd frontend
call npm install
cd ..

echo.
echo ==========================================
echo RESTORE HOAN TAT!
echo ==========================================
echo.
echo KIEM TRA DATABASE:
echo docker exec -it %DB_CONTAINER% psql -U app -d rescue
echo Trong psql: \dt (xem tables), SELECT COUNT(*) FROM "User";
echo.
echo KHOI DONG UNG DUNG:
echo Backend:  cd backend ^&^& npm run start:dev
echo Frontend: cd frontend ^&^& npm run dev
echo ==========================================
pause
