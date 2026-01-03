#!/bin/bash

echo "🚀 Setting up Rescue Me Authentication System..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend Setup
echo "${BLUE}📦 Setting up Backend...${NC}"
cd backend

if [ ! -f ".env" ]; then
  echo "${YELLOW}Creating .env file from .env.example${NC}"
  cp .env.example .env
  echo "${GREEN}✓ Created .env file. Please update with your actual values!${NC}"
else
  echo "${GREEN}✓ .env file already exists${NC}"
fi

echo "Installing backend dependencies..."
npm install

echo "Generating Prisma Client..."
npx prisma generate

echo "${YELLOW}⚠️  Don't forget to:${NC}"
echo "   1. Update DATABASE_URL in backend/.env"
echo "   2. Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
echo "   3. Run: npx prisma migrate dev --name init"
echo ""

# Frontend Setup
cd ../frontend
echo "${BLUE}📦 Setting up Frontend...${NC}"

if [ ! -f ".env.local" ]; then
  echo "${YELLOW}Creating .env.local file from .env.local.example${NC}"
  cp .env.local.example .env.local
  echo "${GREEN}✓ Created .env.local file. Please update with your actual values!${NC}"
else
  echo "${GREEN}✓ .env.local file already exists${NC}"
fi

echo "Installing frontend dependencies..."
npm install

echo ""
echo "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "${BLUE}Next steps:${NC}"
echo "1. Setup PostgreSQL database"
echo "2. Update backend/.env with your DATABASE_URL"
echo "3. Setup Google OAuth credentials"
echo "4. Update GOOGLE_CLIENT_ID in both backend/.env and frontend/.env.local"
echo "5. Run database migrations:"
echo "   ${YELLOW}cd backend && npx prisma migrate dev --name init${NC}"
echo ""
echo "6. Start backend:"
echo "   ${YELLOW}cd backend && npm run start:dev${NC}"
echo ""
echo "7. Start frontend:"
echo "   ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
echo "📖 Read README_AUTH.md for detailed documentation"
