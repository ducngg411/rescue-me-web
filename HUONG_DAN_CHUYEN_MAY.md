# Hướng Dẫn Chuyển Dự Án Sang Laptop Mới

## Bước 1: Backup Data Trên Máy Cũ

### 1.1. Backup Database
```bash
# Tạo thư mục backup
mkdir backup

# Export database từ Docker container
docker exec -t rescue-me-web-db-1 pg_dump -U app -d rescue > backup/database_backup.sql
```

**Lưu ý:** Tên container có thể khác, kiểm tra bằng lệnh:
```bash
docker ps
```

### 1.2. Backup Uploaded Files
Nếu có file uploads (avatar, verification documents, etc):
```bash
# Backup thư mục uploads trong backend
cp -r backend/uploads backup/uploads
```

### 1.3. Backup Environment Variables
Copy các file môi trường:
```bash
# Backend
cp backend/.env backup/.env.backend

# Frontend (nếu có)
cp frontend/.env.local backup/.env.frontend
```

### 1.4. Commit Code Lên Git
```bash
# Đảm bảo tất cả thay đổi đã được commit
git add .
git commit -m "Backup before moving to new laptop"
git push origin main
```

## Bước 2: Setup Trên Laptop Mới

### 2.1. Cài Đặt Prerequisites
- **Node.js** (v18 hoặc v20): https://nodejs.org/
- **Docker Desktop**: https://www.docker.com/products/docker-desktop/
- **Git**: https://git-scm.com/

### 2.2. Clone Project
```bash
git clone <repository-url>
cd rescue-me-web
```

### 2.3. Copy File Backup
Copy thư mục `backup` từ máy cũ sang máy mới (dùng USB, Google Drive, hoặc cloud storage)

### 2.4. Restore Environment Variables
```bash
# Restore backend .env
cp backup/.env.backend backend/.env

# Restore frontend .env (nếu có)
cp backup/.env.frontend frontend/.env.local
```

## Bước 3: Khởi Động Docker & Database

### 3.1. Start Docker Services
```bash
docker-compose up -d
```

### 3.2. Restore Database
```bash
# Import database backup
docker exec -i rescue-me-web-db-1 psql -U app -d rescue < backup/database_backup.sql
```

**Lưu ý:** Nếu gặp lỗi "database already exists", có thể cần xóa database cũ:
```bash
# Drop và recreate database
docker exec -it rescue-me-web-db-1 psql -U app -c "DROP DATABASE IF EXISTS rescue;"
docker exec -it rescue-me-web-db-1 psql -U app -c "CREATE DATABASE rescue;"
docker exec -i rescue-me-web-db-1 psql -U app -d rescue < backup/database_backup.sql
```

### 3.3. Restore Uploaded Files
```bash
# Restore uploads folder
cp -r backup/uploads backend/uploads
```

## Bước 4: Cài Đặt Dependencies & Chạy Project

### 4.1. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```

### 4.2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Bước 5: Kiểm Tra

### 5.1. Kiểm tra Database
```bash
# Vào database để kiểm tra
docker exec -it rescue-me-web-db-1 psql -U app -d rescue

# Trong psql, chạy:
\dt  # Liệt kê các tables
SELECT COUNT(*) FROM "User";  # Kiểm tra số lượng users
\q  # Thoát
```

### 5.2. Kiểm tra Application
- Backend: http://localhost:3000 (hoặc port được cấu hình)
- Frontend: http://localhost:3001 (hoặc port được cấu hình)
- Login với tài khoản cũ để verify data vẫn còn

## Phương Án Dự Phòng

### Nếu Không Muốn Dùng Docker Volume
Bạn có thể dùng bind mount thay vì volume:

```yaml
# Sửa trong docker-compose.yml
services:
  db:
    volumes:
      - ./postgres_data:/var/lib/postgresql/data
```

Cách này data sẽ được lưu trong thư mục `postgres_data` và dễ copy hơn.

### Export/Import Data Bằng Prisma
Thay vì dùng pg_dump, có thể dùng seed data:

```bash
# Trên máy cũ: Export data (cần viết script)
# Trên máy mới: Import data
cd backend
npx prisma db push
npx prisma db seed
```

## Troubleshooting

### Lỗi: Port đã được sử dụng
```bash
# Kiểm tra port đang dùng
netstat -ano | findstr :5432
# Kill process hoặc đổi port trong docker-compose.yml
```

### Lỗi: Docker không start
```bash
# Restart Docker Desktop
# Hoặc remove containers và volumes cũ
docker-compose down -v
docker-compose up -d
```

### Lỗi: Prisma client outdated
```bash
cd backend
npx prisma generate
```

### Lỗi: Node modules không tương thích
```bash
# Xóa node_modules và install lại
rm -rf node_modules package-lock.json
npm install
```

## Checklist Trước Khi Chuyển

- [ ] Backup database (.sql file)
- [ ] Backup uploads folder
- [ ] Backup .env files
- [ ] Push code lên Git
- [ ] Kiểm tra không có local changes chưa commit
- [ ] Note lại các port đang dùng
- [ ] Note lại các API keys và credentials

## Checklist Sau Khi Setup

- [ ] Docker containers đang chạy
- [ ] Database có đầy đủ tables
- [ ] Database có đủ records (kiểm tra count)
- [ ] Backend server chạy không lỗi
- [ ] Frontend server chạy không lỗi
- [ ] Login được với tài khoản cũ
- [ ] Upload files hoạt động
- [ ] API calls hoạt động bình thường
