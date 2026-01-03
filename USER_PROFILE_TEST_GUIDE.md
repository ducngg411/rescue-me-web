# User Profile Completion - Quick Test Guide

## Backend Setup

1. Migration already applied: `20260103160144_add_user_profile_fields`
2. Restart backend if needed:
```bash
cd backend
npm run start:dev
```

## API Testing

### Test 1: Valid Profile Submission

```bash
# First, register/login to get token
curl -X POST http://localhost:3000/auth/register/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser1@example.com",
    "password": "Test1234",
    "name": "Test User"
  }'

# Copy accessToken from response
export TOKEN="your_access_token_here"

# Select USER role
curl -X POST http://localhost:3000/auth/profile/select-role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"USER"}'

# Update profile
curl -X PUT http://localhost:3000/me/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyễn Văn A",
    "phoneNumber": "0912345678",
    "contactEmail": "contact@example.com",
    "defaultAddress": {
      "addressText": "123 Đường ABC, Quận 1, TP.HCM",
      "lat": 10.762622,
      "lng": 106.660172
    },
    "vehicleType": "CAR",
    "licensePlate": "51A-12345",
    "vehicleColor": "Đỏ"
  }'
```

**Expected Response:**
```json
{
  "id": "...",
  "email": "testuser1@example.com",
  "fullName": "Nguyễn Văn A",
  "phoneNumber": "0912345678",
  "profileCompleted": true,
  "role": "USER",
  ...
}
```

### Test 2: Invalid Phone Number

```bash
curl -X PUT http://localhost:3000/me/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "phoneNumber": "1234567890",
    "vehicleType": "CAR",
    "licensePlate": "51A-12345",
    "vehicleColor": "Đen"
  }'
```

**Expected Response (400):**
```json
{
  "statusCode": 400,
  "message": [
    "Số điện thoại không hợp lệ (phải là số VN: 0[39]xxxxxxxx)"
  ],
  "error": "Bad Request"
}
```

### Test 3: Missing fullName

```bash
curl -X PUT http://localhost:3000/me/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0912345678",
    "vehicleType": "MOTORCYCLE",
    "licensePlate": "59B-67890",
    "vehicleColor": "Xanh"
  }'
```

**Expected Response (400):**
```json
{
  "statusCode": 400,
  "message": [
    "Họ tên không được để trống"
  ],
  "error": "Bad Request"
}
```

### Test 4: Non-USER Role Rejection

```bash
# Register as PROVIDER
curl -X POST http://localhost:3000/auth/register/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "provider@example.com",
    "password": "Test1234",
    "name": "Provider"
  }'

# Get token and select PROVIDER role
export PROVIDER_TOKEN="provider_access_token"

curl -X POST http://localhost:3000/auth/profile/select-role \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"PROVIDER"}'

# Try to update USER profile
curl -X PUT http://localhost:3000/me/profile \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Provider Name",
    "phoneNumber": "0987654321",
    "vehicleType": "CAR",
    "licensePlate": "51C-11111",
    "vehicleColor": "Trắng"
  }'
```

**Expected Response (403):**
```json
{
  "statusCode": 403,
  "message": "Chỉ người dùng với role USER mới có thể cập nhật profile này",
  "error": "Forbidden"
}
```

## Frontend Testing

1. Start frontend:
```bash
cd frontend
npm run dev
```

2. Navigate to http://localhost:3001/auth/register
3. Register new account
4. Select USER role at `/onboarding/role`
5. Fill in profile form at `/onboarding/user-profile`:
   - Full Name: Nguyễn Văn A
   - Phone: 0912345678
   - Email: test@example.com (optional)
   - Address: Search using autocomplete
   - Vehicle Type: Select CAR or MOTORCYCLE
   - License Plate: 51A-12345
   - Color: Select from dropdown or enter custom

6. Submit form
7. Should redirect to home page with profileCompleted = true

## Validation Tests

### Valid Phone Numbers
- ✅ 0912345678 (09xxxxxxxx)
- ✅ 0387654321 (03xxxxxxxx)

### Invalid Phone Numbers
- ❌ 1234567890 (doesn't start with 03 or 09)
- ❌ 091234567 (wrong length)
- ❌ 0812345678 (starts with 08, not 03 or 09)

### Vehicle Types
- ✅ CAR
- ✅ MOTORCYCLE
- ❌ TRUCK (not in enum)

### Optional Fields
- contactEmail: can be empty
- defaultAddress: can be empty

## Database Verification

```sql
-- Check user profile after completion
SELECT 
  id, email, "fullName", "phoneNumber", 
  "vehicleType", "licensePlate", "vehicleColor",
  "profileCompleted", role
FROM users 
WHERE email = 'testuser1@example.com';
```

**Expected Result:**
```
fullName: "Nguyễn Văn A"
phoneNumber: "0912345678"
vehicleType: "CAR"
licensePlate: "51A-12345"
vehicleColor: "Đỏ"
profileCompleted: true
role: "USER"
```

## Common Issues

### Issue: Prisma client not updated
**Solution:**
```bash
cd backend
npx prisma generate
# Restart backend server
```

### Issue: Migration not applied
**Solution:**
```bash
cd backend
npx prisma migrate dev
```

### Issue: VietMap autocomplete not working
**Solution:** Replace `YOUR_VIETMAP_API_KEY` with actual API key in the frontend code

## Success Criteria

- ✅ User can fill and submit profile form
- ✅ Invalid phone rejected (client + server)
- ✅ Missing required fields rejected
- ✅ PROVIDER role cannot use USER profile endpoint
- ✅ profileCompleted set to true after submit
- ✅ User redirected to home after completion
- ✅ Cannot access /onboarding/role after completion
