# API Documentation - Authentication Endpoints

## Base URL
```
Development: http://localhost:3001/api
Production: https://api.rescue-me.com/api
```

## Authentication Header
```http
Authorization: Bearer <access_token>
```

---

## 📍 Endpoints Overview

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/auth/register/email` | No | Đăng ký bằng email |
| POST | `/auth/login/email` | No | Đăng nhập bằng email |
| POST | `/auth/login/google` | No | Đăng nhập bằng Google |
| POST | `/auth/profile/complete` | Yes | Hoàn thiện profile |
| GET | `/auth/me` | Yes | Lấy thông tin user hiện tại |
| POST | `/auth/logout` | Yes | Đăng xuất |

---

## 1️⃣ Register with Email

### Request
```http
POST /api/auth/register/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "Nguyễn Văn A"
}
```

### Validation Rules
- `email`: 
  - Required
  - Valid email format
  - Must be unique
- `password`:
  - Required
  - Min 8 characters
  - Must contain at least 1 uppercase letter
  - Must contain at least 1 number
- `name`: Optional

### Success Response (201 Created)
```json
{
  "user": {
    "id": "clx123abc",
    "email": "user@example.com",
    "name": "Nguyễn Văn A",
    "avatar": null,
    "role": "USER",
    "authProvider": "EMAIL",
    "profileCompleted": false,
    "createdAt": "2026-01-03T10:00:00.000Z",
    "updatedAt": "2026-01-03T10:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "requiresProfileCompletion": true
}
```

### Error Responses

#### Email Already Exists (409 Conflict)
```json
{
  "statusCode": 409,
  "message": "Email đã được sử dụng",
  "error": "Conflict"
}
```

#### Validation Error (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": [
    "Email không hợp lệ",
    "Mật khẩu phải có ít nhất 8 ký tự",
    "Mật khẩu phải có ít nhất 1 chữ hoa và 1 số"
  ],
  "error": "Bad Request"
}
```

---

## 2️⃣ Login with Email

### Request
```http
POST /api/auth/login/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

### Validation Rules
- `email`: Required, valid email format
- `password`: Required, min 1 character

### Success Response (200 OK)
```json
{
  "user": {
    "id": "clx123abc",
    "email": "user@example.com",
    "name": "Nguyễn Văn A",
    "avatar": null,
    "role": "USER",
    "authProvider": "EMAIL",
    "profileCompleted": true,
    "phone": "0123456789",
    "address": "123 Đường ABC",
    "emergencyContact": "Nguyễn Thị B - 0987654321",
    "lastLogin": "2026-01-03T10:30:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "requiresProfileCompletion": false
}
```

### Error Responses

#### Invalid Credentials (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Email hoặc mật khẩu không chính xác",
  "error": "Unauthorized"
}
```

#### Wrong Auth Provider (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Tài khoản này được tạo bằng Google. Vui lòng đăng nhập bằng Google",
  "error": "Bad Request"
}
```

---

## 3️⃣ Login with Google

### Request
```http
POST /api/auth/login/google
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE4MmU0M..."
}
```

### How to get ID Token
Frontend uses `@react-oauth/google`:
```typescript
import { GoogleLogin } from '@react-oauth/google';

<GoogleLogin
  onSuccess={(credentialResponse) => {
    // credentialResponse.credential is the ID Token
    loginWithGoogle(credentialResponse.credential);
  }}
/>
```

### Validation Rules
- `idToken`: Required, valid Google ID Token

### Success Response - New User (200 OK)
```json
{
  "user": {
    "id": "clx456def",
    "email": "user@gmail.com",
    "name": "Nguyễn Văn B",
    "avatar": "https://lh3.googleusercontent.com/a/...",
    "role": "USER",
    "authProvider": "GOOGLE",
    "googleId": "1234567890",
    "profileCompleted": false,
    "createdAt": "2026-01-03T11:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "requiresProfileCompletion": true,
  "isNewUser": true
}
```

### Success Response - Existing User (200 OK)
```json
{
  "user": {
    "id": "clx456def",
    "email": "user@gmail.com",
    "name": "Nguyễn Văn B",
    "avatar": "https://lh3.googleusercontent.com/a/...",
    "role": "USER",
    "authProvider": "GOOGLE",
    "googleId": "1234567890",
    "profileCompleted": true,
    "phone": "0123456789",
    "lastLogin": "2026-01-03T11:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "requiresProfileCompletion": false,
  "isNewUser": false
}
```

### Error Responses

#### Invalid Google Token (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Xác thực Google thất bại",
  "error": "Unauthorized"
}
```

---

## 4️⃣ Complete Profile

### Request
```http
POST /api/auth/profile/complete
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Nguyễn Văn A",
  "phone": "0123456789",
  "address": "123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh",
  "emergencyContact": "Nguyễn Thị B - 0987654321 (Mẹ)"
}
```

### Validation Rules
- `name`: Required, string
- `phone`: Required, string
- `address`: Required, string
- `emergencyContact`: Required, string

### Success Response (200 OK)
```json
{
  "id": "clx123abc",
  "email": "user@example.com",
  "name": "Nguyễn Văn A",
  "avatar": null,
  "role": "USER",
  "authProvider": "EMAIL",
  "profileCompleted": true,
  "phone": "0123456789",
  "address": "123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh",
  "emergencyContact": "Nguyễn Thị B - 0987654321 (Mẹ)",
  "updatedAt": "2026-01-03T10:15:00.000Z"
}
```

### Error Responses

#### Unauthorized (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### Validation Error (400)
```json
{
  "statusCode": 400,
  "message": [
    "Họ và tên không được để trống",
    "Số điện thoại không được để trống"
  ],
  "error": "Bad Request"
}
```

---

## 5️⃣ Get Current User

### Request
```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response (200 OK)
```json
{
  "id": "clx123abc",
  "email": "user@example.com",
  "name": "Nguyễn Văn A",
  "avatar": null,
  "role": "USER",
  "authProvider": "EMAIL",
  "profileCompleted": true,
  "phone": "0123456789",
  "address": "123 Đường ABC",
  "emergencyContact": "Nguyễn Thị B - 0987654321",
  "createdAt": "2026-01-03T10:00:00.000Z",
  "updatedAt": "2026-01-03T10:15:00.000Z",
  "lastLogin": "2026-01-03T10:30:00.000Z"
}
```

### Error Responses

#### Invalid Token (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### User Not Found (401)
```json
{
  "statusCode": 401,
  "message": "User không tồn tại",
  "error": "Unauthorized"
}
```

---

## 6️⃣ Logout

### Request
```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response (200 OK)
```json
{
  "message": "Đăng xuất thành công"
}
```

### Notes
- Deletes session from database
- Client should clear tokens from localStorage
- Token becomes invalid immediately

---

## 🔒 JWT Token Structure

### Access Token Payload
```json
{
  "sub": "clx123abc",           // User ID
  "email": "user@example.com",
  "role": "USER",
  "iat": 1704276000,            // Issued at
  "exp": 1704880800             // Expires at (7 days)
}
```

### Refresh Token Payload
```json
{
  "sub": "clx123abc",           // User ID
  "type": "refresh",
  "iat": 1704276000,            // Issued at
  "exp": 1706868000             // Expires at (30 days)
}
```

---

## 🚨 Error Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Validation failed, wrong auth provider |
| 401 | Unauthorized | Invalid credentials, invalid token |
| 409 | Conflict | Email already exists |
| 500 | Internal Server Error | Database error, unexpected error |

---

## 🔄 Token Refresh Flow (Future Implementation)

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response 200:
{
  "accessToken": "new_access_token...",
  "refreshToken": "new_refresh_token..."
}
```

---

## 📝 Testing with cURL

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Complete Profile
```bash
curl -X POST http://localhost:3001/api/auth/profile/complete \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "0123456789",
    "address": "123 Test Street",
    "emergencyContact": "John Doe - 0987654321"
  }'
```

---

## 📚 Postman Collection

Import this into Postman for easier testing:

```json
{
  "info": {
    "name": "Rescue Me - Auth API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001/api"
    },
    {
      "key": "accessToken",
      "value": ""
    }
  ]
}
```

Copy and customize for your needs!
