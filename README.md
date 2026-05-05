# Rescue Me Web

Monorepo cho nền tảng cứu hộ giao thông, gồm:

- Frontend: Next.js (App Router)
- Backend: NestJS + Prisma
- Database: PostgreSQL
- Hạ tầng production: Docker Compose + Nginx reverse proxy

## 1. Tổng quan kiến trúc

- Client web chạy trên Next.js, gọi API qua prefix `/api`.
- Backend NestJS chạy ở port `3001`, expose API prefix `/api`.
- Database dùng PostgreSQL, kết nối qua `DATABASE_URL`.
- Ở production, Nginx reverse proxy:
  - `/api/*` -> backend:3001
  - `/*` -> frontend:3000

Thành phần chính trong source:

- `frontend/`: giao diện người dùng, admin, provider, guest.
- `backend/`: các module nghiệp vụ (auth, rescue-request, dispute, wallet, chatbot, ...).
- `backend/prisma/`: schema, migration, seed.
- `nginx/`: cấu hình reverse proxy TLS.
- `docker-compose.yml`: local DB nhanh.
- `docker-compose.prod.yml`: stack production-like (backend + frontend + nginx).

## 2. Yêu cầu môi trường

- Node.js 20+
- npm 10+
- Docker Desktop (Windows) hoặc Docker Engine (Linux/macOS)
- (Khuyến nghị) Git Bash/WSL nếu chạy script `.sh` trên Windows

## 3. Cấu trúc thư mục

```text
rescue-me-web/
  backend/                 # NestJS API + Prisma
  frontend/                # Next.js app
  nginx/                   # Reverse proxy config
  docs/                    # Tài liệu thiết kế, test, flows
  docker-compose.yml       # Local PostgreSQL
  docker-compose.prod.yml  # Production compose
  restore.bat              # Restore nhanh cho Windows
  restore.sh               # Restore nhanh cho Linux/macOS
```

## 4. Setup local (khuyên dùng cho dev)

### Bước 1: chạy PostgreSQL bằng Docker

Tại root project:

```bash
docker compose up -d
```

Mặc định DB local:

- Host: `localhost`
- Port: `5432`
- DB: `rescue`
- User: `app`
- Password: `app`

### Bước 2: cấu hình backend env

Tại thư mục `backend/`, tạo file `.env`.

Bạn có thể bắt đầu từ `backend/.env.production.example` rồi đổi về giá trị local.

Biến tối thiểu để backend khởi động local:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://app:app@localhost:5432/rescue?schema=public"

JWT_SECRET=replace_with_strong_secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

FRONTEND_URL=http://localhost:3000
```

Lưu ý:

- Nhiều tính năng cần thêm key dịch vụ ngoài (Google OAuth, Firebase, Cloudinary, R2, VietMap, OpenAI, SMTP, Sepay...).
- Nếu chưa dùng các tính năng đó ngay, có thể bổ sung dần theo module bạn đang test.

### Bước 3: cài package + migrate Prisma backend

```bash
cd backend
npm install
npx prisma generate
npm run db:migrate
```

Nếu cần seed dữ liệu:

```bash
npm run seed
npm run seed:admin
```

`seed:admin` dùng:

- `ADMIN_EMAIL` (mặc định `admin@rescue.com` nếu không khai báo)
- `ADMIN_PASSWORD` (mặc định `Admin@123` nếu không khai báo)

### Bước 4: chạy backend

```bash
cd backend
npm run start:dev
```

API base local:

- `http://localhost:3001/api`

Swagger (chỉ non-production):

- `http://localhost:3001/api/docs`

### Bước 5: cấu hình frontend env

Tại `frontend/`, tạo file `.env.local`.

Tối thiểu nên có:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

NEXT_PUBLIC_R2_PUBLIC_DOMAIN=
NEXT_PUBLIC_VIETMAP_API_KEY=
NEXT_PUBLIC_COMMISSION_RATE=0.2
NEXT_PUBLIC_SUPPORT_HOTLINE=1900 1234
```

### Bước 6: chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local:

- `http://localhost:3000`

## 5. Chạy production-like bằng Docker Compose

File dùng: `docker-compose.prod.yml`

### Chuẩn bị env

1. Backend:
   - copy `backend/.env.production.example` -> `backend/.env.production`
   - điền đầy đủ giá trị thực tế
2. Frontend:
   - tạo `frontend/.env.production`
   - khai báo các biến `NEXT_PUBLIC_*` dùng cho build args

Ví dụ frontend `.env.production`:

```env
NEXT_PUBLIC_API_URL=https://your-domain/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_R2_PUBLIC_DOMAIN=
NEXT_PUBLIC_VIETMAP_API_KEY=
```

### Build và chạy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Compose production chạy các service:

- `backend` (NestJS, tự chạy `prisma migrate deploy` trước khi start)
- `frontend` (Next.js standalone)
- `nginx` (reverse proxy + SSL)

## 6. Script restore dữ liệu

Project có sẵn script phục hồi nhanh từ thư mục backup (`backup_*`):

- Windows: `restore.bat`
- Linux/macOS: `restore.sh`

Script sẽ:

- khởi động Docker services
- restore env files từ backup
- restore PostgreSQL dump
- restore thư mục uploads
- cài dependencies backend/frontend

## 7. Lệnh thường dùng

### Backend

```bash
cd backend
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
npm run db:migrate
npm run seed
npm run seed:admin
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run start
npm run lint
```

### Docker

```bash
# local db
docker compose up -d
docker compose down

# production-like
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml restart backend
```

## 8. Troubleshooting nhanh

- Backend không kết nối DB:
  - kiểm tra `DATABASE_URL`
  - kiểm tra container `db` đã up chưa (`docker compose ps`)
- Prisma lỗi schema/client:
  - chạy lại `npx prisma generate`
  - chạy `npm run db:migrate`
- Frontend gọi sai API:
  - kiểm tra `NEXT_PUBLIC_API_URL`
  - restart frontend sau khi đổi env
- Không thấy Swagger:
  - Swagger chỉ bật khi `NODE_ENV != production`

## 9. Tài liệu bổ sung

- Thiết kế dữ liệu: `docs/cdm.md`, `docs/pdm.md`
- Sequence diagram: `docs/sequence-diagram.md`
- Test plan/log: `docs/test-plan.md`, `docs/test-log.md`

---

Nếu cần, có thể tách README thành:

- `README.md` (overview + quickstart)
- `docs/setup-local.md`
- `docs/deployment.md`
- `docs/env.md`

để tài liệu ngắn gọn và dễ maintain hơn khi dự án mở rộng.