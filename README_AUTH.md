# Rescue Me - Authentication & Onboarding System

## 📋 Tổng quan

Hệ thống Authentication & Onboarding hoàn chỉnh cho nền tảng Rescue Service với các tính năng:

- ✅ Đăng ký/Đăng nhập bằng Google OAuth
- ✅ Đăng ký/Đăng nhập bằng Email/Password
- ✅ Password strength validation
- ✅ Profile completion flow
- ✅ JWT-based authentication
- ✅ Protected routes
- ✅ Session management

## 🏗️ Kiến trúc hệ thống

### Backend Stack
- **Framework**: NestJS 11
- **Database**: PostgreSQL
- **ORM**: Prisma 7
- **Authentication**: Passport.js + JWT
- **OAuth**: Google OAuth 2.0
- **Password Hashing**: bcrypt

### Frontend Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **OAuth**: @react-oauth/google

---

## 📊 Database Schema

### User Model
```prisma
model User {
  id               String       @id @default(cuid())
  email            String       @unique
  name             String?
  avatar           String?
  
  // Authentication
  authProvider     AuthProvider
  hashedPassword   String?      // Chỉ dùng cho EMAIL auth
  googleId         String?      @unique // Chỉ dùng cho GOOGLE auth
  
  // Profile & Onboarding
  profileCompleted Boolean      @default(false)
  phone            String?
  address          String?
  emergencyContact String?
  
  // Role & Permissions
  role             UserRole     @default(USER)
  
  // Timestamps
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  lastLogin        DateTime?
  
  // Relations
  sessions         Session[]
}

enum AuthProvider {
  EMAIL
  GOOGLE
}

enum UserRole {
  USER
  ADMIN
  RESCUER
}
```

### Session Model
```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  refreshToken String?  @unique
  expiresAt    DateTime
  userAgent    String?
  ipAddress    String?
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 🔌 API Endpoints

### Authentication Endpoints

#### 1. Register with Email
```http
POST /api/auth/register/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "Nguyễn Văn A"
}

Response 201:
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "Nguyễn Văn A",
    "role": "USER",
    "authProvider": "EMAIL",
    "profileCompleted": false
  },
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  },
  "requiresProfileCompletion": true
}
```

#### 2. Login with Email
```http
POST /api/auth/login/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response 200:
{
  "user": { ... },
  "tokens": { ... },
  "requiresProfileCompletion": false
}
```

#### 3. Login with Google
```http
POST /api/auth/login/google
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1..."
}

Response 200:
{
  "user": { ... },
  "tokens": { ... },
  "requiresProfileCompletion": true,
  "isNewUser": true
}
```

#### 4. Complete Profile
```http
POST /api/auth/profile/complete
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Nguyễn Văn A",
  "phone": "0123456789",
  "address": "123 Đường ABC, Quận XYZ, TP.HCM",
  "emergencyContact": "Nguyễn Thị B - 0987654321 (Mẹ)"
}

Response 200:
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "Nguyễn Văn A",
  "phone": "0123456789",
  "profileCompleted": true,
  ...
}
```

#### 5. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access_token>

Response 200:
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "Nguyễn Văn A",
  "profileCompleted": true,
  ...
}
```

#### 6. Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>

Response 200:
{
  "message": "Đăng xuất thành công"
}
```

---

## 🔐 Security Features

### 1. Password Requirements
- Tối thiểu 8 ký tự
- Ít nhất 1 chữ hoa (A-Z)
- Ít nhất 1 số (0-9)
- Password strength indicator: Weak / Medium / Strong

### 2. Token Security
- **Access Token**: JWT, expires in 7 days
- **Refresh Token**: expires in 30 days
- Stored in localStorage (client-side)
- Verified on every API request

### 3. Google OAuth Security
- ID Token verification using google-auth-library
- Client ID validation
- Audience validation

### 4. Session Management
- Database-backed sessions
- Cascade delete on user deletion
- Token tracking per session

---

## 🚀 Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your actual values:
# - DATABASE_URL
# - JWT_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET

# Setup database
npx prisma generate
npx prisma migrate dev --name init

# Start backend server
npm run start:dev
```

Backend will run on `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your actual values:
# - NEXT_PUBLIC_API_URL
# - NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Start frontend server
npm run dev
```

Frontend will run on `http://localhost:3000`

### 3. Google OAuth Setup

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project có sẵn
3. Enable Google+ API
4. Tạo OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3001/api/auth/google/callback`
5. Copy Client ID và Client Secret vào file .env

---

## 📱 Frontend Flow & Redirect Logic

### Registration Flow (Email)

```
1. User visits /auth/register
2. User fills form (email, password, name)
3. Frontend validates:
   - Email format
   - Password strength (must be >= medium)
   - Password confirmation match
4. Submit to POST /api/auth/register/email
5. Backend creates user with profileCompleted = false
6. Store tokens in localStorage
7. Redirect to /auth/complete-profile
```

### Registration Flow (Google)

```
1. User visits /auth/register (or /auth/login)
2. User clicks "Tiếp tục với Google"
3. Google OAuth popup opens
4. User selects Google account
5. Frontend receives ID Token
6. Submit to POST /api/auth/login/google
7. Backend checks if user exists:
   - New user: create with profileCompleted = false
   - Existing user: return existing user
8. Store tokens in localStorage
9. Redirect based on profileCompleted:
   - false → /auth/complete-profile
   - true → /
```

### Login Flow (Email)

```
1. User visits /auth/login
2. User enters email & password
3. Submit to POST /api/auth/login/email
4. Backend validates:
   - User exists
   - AuthProvider = EMAIL
   - Password correct
5. Store tokens in localStorage
6. Redirect based on profileCompleted:
   - false → /auth/complete-profile
   - true → /
```

### Login Flow (Google)

```
1. User visits /auth/login
2. User clicks "Tiếp tục với Google"
3. Same as Registration Flow (Google)
```

### Profile Completion Flow

```
1. User at /auth/complete-profile
2. User fills form:
   - Name (required)
   - Phone (required, 10-11 digits)
   - Address (required)
   - Emergency Contact (required)
3. Submit to POST /api/auth/profile/complete
4. Backend updates user with profileCompleted = true
5. Redirect to / (home)
```

### Protected Route Flow

```
1. User visits / (home)
2. AuthContext checks localStorage for accessToken
3. If no token:
   - Redirect to /auth/login
4. If token exists:
   - Verify token with GET /api/auth/me
   - If valid: show page
   - If invalid: clear token, redirect to /auth/login
```

---

## 🎯 Business Rules Implementation

### ✅ Validation Rules

#### Email Registration
- Email format validation (regex)
- Email uniqueness check
- Password strength >= medium
- Password confirmation match

#### Email Login
- Email/password combination validation
- AuthProvider check (must be EMAIL)
- Error message: "Email hoặc mật khẩu không chính xác"
- Special case: Google account → "Tài khoản này được tạo bằng Google..."

#### Google Auth
- ID Token verification
- Email from Google payload
- Auto-create user if not exists
- Update lastLogin timestamp

#### Profile Completion
- All fields required
- Phone format: 10-11 digits
- Cannot access main app until completed

---

## 🧪 Testing Scenarios

### Test Case 1: New User Registration (Email)
```
1. Navigate to /auth/register
2. Fill form with new email
3. Use weak password → should show error
4. Use strong password (e.g., "SecurePass123")
5. Submit form
6. Should redirect to /auth/complete-profile
7. Complete profile
8. Should redirect to /
```

### Test Case 2: Existing User Login (Email)
```
1. Navigate to /auth/login
2. Enter registered email & password
3. Submit form
4. If profile completed → redirect to /
5. If not → redirect to /auth/complete-profile
```

### Test Case 3: Google OAuth (New User)
```
1. Navigate to /auth/register or /auth/login
2. Click "Tiếp tục với Google"
3. Select Google account
4. Should create new user
5. Redirect to /auth/complete-profile
6. Complete profile
7. Redirect to /
```

### Test Case 4: Google OAuth (Existing User)
```
1. User already registered with Google
2. Click "Tiếp tục với Google"
3. Should login successfully
4. Redirect based on profileCompleted status
```

### Test Case 5: Wrong AuthProvider
```
1. User registered with Google
2. Try to login with email/password
3. Should show error: "Tài khoản này được tạo bằng Google..."
```

### Test Case 6: Protected Route Access
```
1. Not logged in
2. Navigate to /
3. Should redirect to /auth/login
```

---

## 📝 Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/rescue_me_db"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"
FRONTEND_URL="http://localhost:3000"
PORT=3001
NODE_ENV="development"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

---

## 🔄 Database Migration Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio (Database GUI)
npx prisma studio
```

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Error
**Problem**: Frontend cannot connect to backend  
**Solution**: Check `FRONTEND_URL` in backend .env matches frontend URL

### Issue 2: Google OAuth Not Working
**Problem**: Google login popup closes without action  
**Solution**: 
1. Verify GOOGLE_CLIENT_ID in both frontend and backend
2. Check authorized origins in Google Cloud Console
3. Make sure popup is not blocked by browser

### Issue 3: JWT Token Invalid
**Problem**: User logged out automatically  
**Solution**: 
1. Check JWT_SECRET is same for all requests
2. Verify token expiration settings
3. Clear localStorage and login again

### Issue 4: Database Connection Error
**Problem**: Cannot connect to PostgreSQL  
**Solution**:
1. Verify DATABASE_URL format
2. Check PostgreSQL is running
3. Verify database exists
4. Run `npx prisma migrate deploy`

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [JWT Best Practices](https://jwt.io/introduction)

---

## 👨‍💻 Development Team

Developed as part of the Rescue Me platform authentication system.

## 📄 License

Proprietary - All rights reserved
