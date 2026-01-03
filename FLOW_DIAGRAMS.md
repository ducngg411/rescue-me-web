# Authentication & Onboarding Flow Diagrams

## 1. Email Registration Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ Visits /auth/register
       ▼
┌─────────────────────────┐
│  Registration Page      │
│  - Email input          │
│  - Password input       │
│  - Password strength    │
│  - Name input           │
└──────────┬──────────────┘
           │
           │ Fills form + Submit
           ▼
┌─────────────────────────┐
│  Frontend Validation    │
│  - Email format         │
│  - Password >= medium   │
│  - Match confirmation   │
└──────────┬──────────────┘
           │
           │ POST /api/auth/register/email
           ▼
┌─────────────────────────┐
│  Backend (NestJS)       │
│  1. Check email exists? │
│  2. Hash password       │
│  3. Create user         │
│     - profileCompleted=false
│  4. Create session      │
│  5. Generate JWT        │
└──────────┬──────────────┘
           │
           │ Return tokens + user
           ▼
┌─────────────────────────┐
│  Frontend               │
│  - Store tokens         │
│  - Set user in context  │
│  - Redirect to          │
│    /auth/complete-profile
└─────────────────────────┘
```

## 2. Email Login Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ Visits /auth/login
       ▼
┌─────────────────────────┐
│  Login Page             │
│  - Email input          │
│  - Password input       │
└──────────┬──────────────┘
           │
           │ Submit credentials
           ▼
           POST /api/auth/login/email
           │
           ▼
┌──────────────────────────────┐
│  Backend (NestJS)            │
│  1. Find user by email       │
│  2. User exists?             │
│     ├─ No  → 401 Error       │
│     └─ Yes → Continue        │
│  3. AuthProvider = EMAIL?    │
│     ├─ No  → 400 Error       │
│     │        "Use Google"    │
│     └─ Yes → Continue        │
│  4. Verify password          │
│     ├─ Invalid → 401 Error   │
│     └─ Valid → Continue      │
│  5. Update lastLogin         │
│  6. Create session           │
│  7. Generate JWT             │
└──────────┬───────────────────┘
           │
           │ Return tokens + user
           ▼
┌─────────────────────────┐
│  Frontend               │
│  - Store tokens         │
│  - Set user in context  │
│  - Check profileCompleted
│     ├─ false → /auth/complete-profile
│     └─ true  → /
└─────────────────────────┘
```

## 3. Google OAuth Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ Visits /auth/login or /auth/register
       ▼
┌─────────────────────────┐
│  Login/Register Page    │
│  - Google OAuth Button  │
└──────────┬──────────────┘
           │
           │ Click "Continue with Google"
           ▼
┌─────────────────────────┐
│  Google OAuth Popup     │
│  - Account selection    │
└──────────┬──────────────┘
           │
           │ User selects account
           ▼
┌─────────────────────────┐
│  Google                 │
│  - Verify credentials   │
│  - Generate ID Token    │
└──────────┬──────────────┘
           │
           │ Return ID Token to frontend
           ▼
┌─────────────────────────┐
│  Frontend               │
│  - Receive ID Token     │
└──────────┬──────────────┘
           │
           │ POST /api/auth/login/google
           │ { idToken: "..." }
           ▼
┌──────────────────────────────────┐
│  Backend (NestJS)                │
│  1. Verify ID Token with Google  │
│  2. Extract email, name, picture │
│  3. Find user by email           │
│  4. User exists?                 │
│     ├─ No  → Create new user     │
│     │        - profileCompleted=false
│     │        - authProvider=GOOGLE
│     │        - googleId=sub
│     └─ Yes → Use existing user   │
│  5. Update lastLogin             │
│  6. Create session               │
│  7. Generate JWT                 │
└──────────┬───────────────────────┘
           │
           │ Return tokens + user + isNewUser
           ▼
┌─────────────────────────┐
│  Frontend               │
│  - Store tokens         │
│  - Set user in context  │
│  - Check profileCompleted
│     ├─ false → /auth/complete-profile
│     └─ true  → /
└─────────────────────────┘
```

## 4. Profile Completion Flow

```
┌─────────────┐
│   User      │
│ (New user)  │
└──────┬──────┘
       │
       │ Redirected to /auth/complete-profile
       ▼
┌─────────────────────────┐
│  Complete Profile Page  │
│  - Name                 │
│  - Phone                │
│  - Address              │
│  - Emergency Contact    │
└──────────┬──────────────┘
           │
           │ Fills all required fields
           ▼
┌─────────────────────────┐
│  Frontend Validation    │
│  - All fields required  │
│  - Phone format         │
└──────────┬──────────────┘
           │
           │ POST /api/auth/profile/complete
           │ Authorization: Bearer <token>
           ▼
┌──────────────────────────────┐
│  Backend (NestJS)            │
│  1. Verify JWT token         │
│  2. Get user from token      │
│  3. Update user:             │
│     - name                   │
│     - phone                  │
│     - address                │
│     - emergencyContact       │
│     - profileCompleted=true  │
└──────────┬───────────────────┘
           │
           │ Return updated user
           ▼
┌─────────────────────────┐
│  Frontend               │
│  - Update user context  │
│  - Redirect to /        │
└─────────────────────────┘
```

## 5. Protected Route Access Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ Visits / (home)
       ▼
┌─────────────────────────┐
│  AuthContext            │
│  - Check localStorage   │
│    for accessToken      │
└──────────┬──────────────┘
           │
           ├─ No token found
           │  └─> Redirect to /auth/login
           │
           └─ Token found
              │
              ▼
           GET /api/auth/me
           Authorization: Bearer <token>
              │
              ▼
┌──────────────────────────────┐
│  Backend (NestJS)            │
│  1. Verify JWT signature     │
│  2. Check token expiration   │
│  3. Get user from token.sub  │
│  4. User exists?             │
│     ├─ No  → 401 Error       │
│     └─ Yes → Return user     │
└──────────┬───────────────────┘
           │
           ├─ Valid token
           │  └─> Set user in context
           │      Show protected page
           │
           └─ Invalid token
              └─> Clear localStorage
                  Redirect to /auth/login
```

## 6. Session & Token Management

```
┌─────────────────────────┐
│  User Login Success     │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Backend Creates Session     │
│  ┌────────────────────────┐  │
│  │ Session (Database)     │  │
│  │ - id                   │  │
│  │ - userId               │  │
│  │ - token (accessToken)  │  │
│  │ - refreshToken         │  │
│  │ - expiresAt (+7 days)  │  │
│  │ - userAgent            │  │
│  │ - ipAddress            │  │
│  └────────────────────────┘  │
└──────────┬───────────────────┘
           │
           │ Generate JWT
           ▼
┌──────────────────────────────┐
│  JWT Access Token            │
│  {                           │
│    sub: userId,              │
│    email: user.email,        │
│    role: user.role,          │
│    iat: now,                 │
│    exp: now + 7days          │
│  }                           │
└──────────┬───────────────────┘
           │
           │ Send to Frontend
           ▼
┌──────────────────────────────┐
│  Frontend                    │
│  - localStorage.accessToken  │
│  - localStorage.refreshToken │
└──────────────────────────────┘

Every API Request:
┌──────────────────────────────┐
│  Frontend                    │
│  - Add Authorization header  │
│    Bearer <accessToken>      │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Backend Middleware          │
│  - Extract token from header │
│  - Verify JWT signature      │
│  - Check expiration          │
│  - Attach user to request    │
└──────────────────────────────┘
```

## 7. Logout Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ Click "Logout"
       ▼
       POST /api/auth/logout
       Authorization: Bearer <token>
       │
       ▼
┌──────────────────────────────┐
│  Backend (NestJS)            │
│  1. Get token from header    │
│  2. Delete session from DB:  │
│     WHERE userId = user.id   │
│     AND token = <token>      │
└──────────┬───────────────────┘
           │
           │ Return success
           ▼
┌─────────────────────────┐
│  Frontend               │
│  - Clear localStorage   │
│    - accessToken        │
│    - refreshToken       │
│  - Clear user context   │
│  - Redirect to          │
│    /auth/login          │
└─────────────────────────┘
```

## 8. Error Handling Scenarios

```
Scenario 1: Email Already Exists
┌─────────────────────────┐
│  POST /auth/register    │
│  email: "existing@..."  │
└──────────┬──────────────┘
           │
           ▼ Backend checks
┌─────────────────────────┐
│  User.findUnique()      │
│  Result: User found     │
└──────────┬──────────────┘
           │
           ▼
        409 Conflict
  "Email đã được sử dụng"


Scenario 2: Wrong Auth Provider
┌─────────────────────────┐
│  POST /auth/login/email │
│  User registered with   │
│  Google OAuth           │
└──────────┬──────────────┘
           │
           ▼ Backend checks
┌─────────────────────────┐
│  user.authProvider      │
│  = "GOOGLE"             │
└──────────┬──────────────┘
           │
           ▼
        400 Bad Request
  "Tài khoản này được tạo
   bằng Google. Vui lòng
   đăng nhập bằng Google"


Scenario 3: Invalid Credentials
┌─────────────────────────┐
│  POST /auth/login/email │
│  Wrong password         │
└──────────┬──────────────┘
           │
           ▼ Backend checks
┌─────────────────────────┐
│  bcrypt.compare()       │
│  Result: false          │
└──────────┬──────────────┘
           │
           ▼
      401 Unauthorized
  "Email hoặc mật khẩu
   không chính xác"


Scenario 4: Token Expired
┌─────────────────────────┐
│  GET /auth/me           │
│  Token expired          │
└──────────┬──────────────┘
           │
           ▼ Backend checks
┌─────────────────────────┐
│  JWT verify()           │
│  exp < now              │
└──────────┬──────────────┘
           │
           ▼
      401 Unauthorized
           │
           ▼ Frontend
┌─────────────────────────┐
│  Interceptor catches    │
│  - Clear localStorage   │
│  - Redirect /auth/login │
└─────────────────────────┘
```

## 9. Data Flow Summary

```
Frontend                Backend               Database
   │                       │                     │
   │  Registration         │                     │
   ├──────────────────────>│                     │
   │                       │  Create User        │
   │                       ├────────────────────>│
   │                       │                     │
   │                       │  Create Session     │
   │                       ├────────────────────>│
   │                       │                     │
   │  Tokens + User        │                     │
   │<──────────────────────┤                     │
   │                       │                     │
   │  Store in localStorage│                     │
   │                       │                     │
   │  Protected Request    │                     │
   ├──────────────────────>│                     │
   │  (with Bearer token)  │                     │
   │                       │  Verify Token       │
   │                       │  Get User           │
   │                       ├────────────────────>│
   │                       │                     │
   │  Response             │                     │
   │<──────────────────────┤                     │
   │                       │                     │
```

## 10. State Management

```
Application State Flow:

Initial Load
   │
   ▼
AuthContext initializes
   │
   ├─ Check localStorage
   │  ├─ No token → loading=false, user=null
   │  └─ Token found
   │     │
   │     ▼
   │  GET /api/auth/me
   │     │
   │     ├─ Success → user=userData, loading=false
   │     └─ Error → user=null, loading=false
   │
   ▼
Render App
   │
   ├─ user=null → Show Login/Register
   └─ user=data → Show Protected Content
      │
      ├─ profileCompleted=false → Force Complete Profile
      └─ profileCompleted=true → Full Access
```

---

## Legend

```
┌─────┐  Component/Page
│     │
└─────┘

┌─────┐  Process/Action
│     │
└─────┘

   │     Flow direction
   ▼

───────  Connection

├─ ─ ─  Decision branch
```
