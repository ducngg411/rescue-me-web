#!/bin/bash
# Script backup data truoc khi chuyen may (Linux/Mac)

echo "=========================================="
echo "   BACKUP DU AN RESCUE-ME-WEB"
echo "=========================================="
echo ""

# Tao thu muc backup voi timestamp
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backup_${BACKUP_DATE}"

echo "Tao thu muc backup: ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}"

# Backup database
echo ""
echo "[1/4] Backup database..."
if ! docker ps | grep -q "db"; then
    echo "CANH BAO: Docker container khong chay! Hay start docker truoc."
    exit 1
fi

DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
echo "Container name: ${DB_CONTAINER}"
docker exec -t "${DB_CONTAINER}" pg_dump -U app -d rescue > "${BACKUP_DIR}/database_backup.sql"
if [ $? -eq 0 ]; then
    echo "- Database backup thanh cong!"
else
    echo "LOI: Khong the backup database!"
fi

# Backup uploads folder
echo ""
echo "[2/4] Backup uploads folder..."
if [ -d "backend/uploads" ]; then
    cp -r backend/uploads "${BACKUP_DIR}/uploads"
    echo "- Uploads backup thanh cong!"
else
    echo "- Khong tim thay thu muc uploads"
fi

# Backup .env files
echo ""
echo "[3/4] Backup environment files..."
if [ -f "backend/.env" ]; then
    cp backend/.env "${BACKUP_DIR}/.env.backend"
    echo "- Backend .env backup thanh cong!"
else
    echo "- Khong tim thay backend/.env"
fi

if [ -f "frontend/.env.local" ]; then
    cp frontend/.env.local "${BACKUP_DIR}/.env.frontend"
    echo "- Frontend .env backup thanh cong!"
else
    echo "- Khong tim thay frontend/.env.local"
fi

# Create backup info
echo ""
echo "[4/4] Tao file thong tin backup..."
cat > "${BACKUP_DIR}/backup_info.txt" << EOF
Backup created: $(date)
Docker containers:
$(docker ps)
EOF

echo ""
echo "=========================================="
echo "BACKUP HOAN TAT!"
echo "=========================================="
echo "Thu muc backup: ${BACKUP_DIR}"
echo ""
echo "BUOC TIEP THEO:"
echo "1. Commit code: git add . && git commit -m 'Backup' && git push"
echo "2. Copy thu muc '${BACKUP_DIR}' sang laptop moi"
echo "3. Chay script restore.sh tren laptop moi"
echo "=========================================="
