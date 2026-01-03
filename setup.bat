@echo off
echo 🚀 Setting up Rescue Me Authentication System...
echo.

REM Backend Setup
echo 📦 Setting up Backend...
cd backend

if not exist .env (
  echo Creating .env file from .env.example
  copy .env.example .env
  echo ✓ Created .env file. Please update with your actual values!
) else (
  echo ✓ .env file already exists
)

echo Installing backend dependencies...
call npm install

echo Generating Prisma Client...
call npx prisma generate

echo.
echo ⚠️  Don't forget to:
echo    1. Update DATABASE_URL in backend\.env
echo    2. Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
echo    3. Run: npx prisma migrate dev --name init
echo.

REM Frontend Setup
cd ..\frontend
echo 📦 Setting up Frontend...

if not exist .env.local (
  echo Creating .env.local file from .env.local.example
  copy .env.local.example .env.local
  echo ✓ Created .env.local file. Please update with your actual values!
) else (
  echo ✓ .env.local file already exists
)

echo Installing frontend dependencies...
call npm install

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Setup PostgreSQL database
echo 2. Update backend\.env with your DATABASE_URL
echo 3. Setup Google OAuth credentials
echo 4. Update GOOGLE_CLIENT_ID in both backend\.env and frontend\.env.local
echo 5. Run database migrations:
echo    cd backend ^&^& npx prisma migrate dev --name init
echo.
echo 6. Start backend:
echo    cd backend ^&^& npm run start:dev
echo.
echo 7. Start frontend:
echo    cd frontend ^&^& npm run dev
echo.
echo 📖 Read README_AUTH.md for detailed documentation
echo.
pause
