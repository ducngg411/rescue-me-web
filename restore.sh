#!/bin/bash
# Script restore data tren may moi (Linux/Mac)

echo "=========================================="
echo "   RESTORE DU AN RESCUE-ME-WEB"
echo "=========================================="
echo ""

# Tim thu muc backup
BACKUP_DIR=$(find . -maxdepth 1 -name "backup_*" -type d | head -n 1)

if [ -z "${BACKUP_DIR}" ]; then
    echo "LOI: Khong tim thay thu muc backup!"
    echo "Hay copy thu muc backup tu may cu sang day."
    exit 1
fi

echo "Su dung thu muc backup: ${BACKUP_DIR}"
echo ""

# Check Docker
echo "Kiem tra Docker..."
if ! docker ps > /dev/null 2>&1; then
    echo "LOI: Docker khong chay! Hay start Docker."
    exit 1
fi

# Start docker-compose
echo ""
echo "[1/5] Khoi dong Docker services..."
docker-compose up -d
sleep 10
echo "- Docker services da khoi dong!"

# Restore environment files
echo ""
echo "[2/5] Restore environment files..."
if [ -f "${BACKUP_DIR}/.env.backend" ]; then
    cp "${BACKUP_DIR}/.env.backend" backend/.env
    echo "- Backend .env restored!"
else
    echo "- Khong tim thay .env.backend trong backup"
fi

if [ -f "${BACKUP_DIR}/.env.frontend" ]; then
    cp "${BACKUP_DIR}/.env.frontend" frontend/.env.local
    echo "- Frontend .env restored!"
else
    echo "- Khong tim thay .env.frontend trong backup"
fi

# Restore database
echo ""
echo "[3/5] Restore database..."
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
echo "Container name: ${DB_CONTAINER}"

# Drop va recreate database
docker exec -i "${DB_CONTAINER}" psql -U app -c "DROP DATABASE IF EXISTS rescue;" > /dev/null 2>&1
docker exec -i "${DB_CONTAINER}" psql -U app -c "CREATE DATABASE rescue;" > /dev/null
docker exec -i "${DB_CONTAINER}" psql -U app -d rescue < "${BACKUP_DIR}/database_backup.sql" > /dev/null

if [ $? -eq 0 ]; then
    echo "- Database restored thanh cong!"
else
    echo "LOI: Khong the restore database!"
    echo "Thu restore thu cong: docker exec -i ${DB_CONTAINER} psql -U app -d rescue < ${BACKUP_DIR}/database_backup.sql"
fi

# Restore uploads
echo ""
echo "[4/5] Restore uploads folder..."
if [ -d "${BACKUP_DIR}/uploads" ]; then
    mkdir -p backend/uploads
    cp -r "${BACKUP_DIR}/uploads/"* backend/uploads/
    echo "- Uploads restored thanh cong!"
else
    echo "- Khong tim thay thu muc uploads trong backup"
fi

# Install dependencies
echo ""
echo "[5/5] Cai dat dependencies..."
echo ""
echo "=== BACKEND ==="
cd backend
npm install
npx prisma generate
cd ..

echo ""
echo "=== FRONTEND ==="
cd frontend
npm install
cd ..

echo ""
echo "=========================================="
echo "RESTORE HOAN TAT!"
echo "=========================================="
echo ""
echo "KIEM TRA DATABASE:"
echo "docker exec -it ${DB_CONTAINER} psql -U app -d rescue"
echo "Trong psql: \dt (xem tables), SELECT COUNT(*) FROM \"User\";"
echo ""
echo "KHOI DONG UNG DUNG:"
echo "Backend:  cd backend && npm run start:dev"
echo "Frontend: cd frontend && npm run dev"
echo "=========================================="
