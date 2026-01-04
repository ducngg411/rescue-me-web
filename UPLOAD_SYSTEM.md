# Cloudflare R2 Upload System

Upload system sử dụng Cloudflare R2 (S3-compatible storage) với presigned URLs cho Rescue Me application.

## 📋 Tổng quan

Hệ thống upload trực tiếp từ frontend lên Cloudflare R2, không qua backend để tối ưu performance và giảm tải server.

### Flow

```
1. Frontend → POST /api/uploads/presign → Backend
   ↓
2. Backend tạo presigned URL và lưu metadata vào DB
   ↓
3. Frontend ← { uploadUrl, objectKey, publicUrl, uploadId }
   ↓
4. Frontend → PUT file → Cloudflare R2 (direct upload)
   ↓
5. Frontend → POST /api/uploads/confirm → Backend
   ↓
6. Backend xác nhận upload và cập nhật DB
```

## 🔧 Backend Setup

### 1. Dependencies

```bash
cd backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Environment Variables

Thêm vào `backend/.env`:

```env
# Cloudflare R2 Configuration
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="rescue-me-uploads"
R2_PUBLIC_DOMAIN="https://cdn.rescue-me.com"
```

### 3. Prisma Migration

```bash
cd backend
npx prisma migrate dev --name add_upload_model
npx prisma generate
```

### 4. Files Created

```
backend/src/uploads/
├── dto/
│   ├── presign-upload.dto.ts
│   └── confirm-upload.dto.ts
├── uploads.controller.ts
├── uploads.service.ts
└── uploads.module.ts
```

## 🎨 Frontend Setup

### Files Created

```
frontend/
├── lib/
│   ├── upload.ts                    # Upload utilities
│   └── hooks/
│       └── useUpload.ts             # Upload hook
├── components/
│   ├── FileUpload.tsx               # Reusable upload component
│   └── ProviderVerificationUpload.tsx # Example usage
└── app/examples/upload/
    └── page.tsx                      # Demo page
```

## 📝 Usage Examples

### 1. Using the FileUpload Component

```tsx
import FileUpload from '@/components/FileUpload';
import { UploadPurpose } from '@/lib/upload';

function MyComponent() {
  return (
    <FileUpload
      purpose={UploadPurpose.REQUEST_PHOTO}
      label="Upload Photo"
      onSuccess={(result) => {
        console.log('Uploaded:', result.publicUrl);
      }}
      onError={(error) => {
        console.error('Error:', error);
      }}
    />
  );
}
```

### 2. Using the useUpload Hook

```tsx
import { useUpload } from '@/lib/hooks/useUpload';
import { UploadPurpose } from '@/lib/upload';

function MyComponent() {
  const { upload, uploading, progress, error, result } = useUpload({
    purpose: UploadPurpose.REQUEST_PHOTO,
    onSuccess: (result) => {
      console.log('Success:', result.publicUrl);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} disabled={uploading} />
      {uploading && <div>Progress: {progress}%</div>}
      {error && <div>Error: {error}</div>}
      {result?.publicUrl && <img src={result.publicUrl} alt="Uploaded" />}
    </div>
  );
}
```

### 3. Using the uploadFile Function Directly

```tsx
import { uploadFile, UploadPurpose } from '@/lib/upload';

async function handleUpload(file: File) {
  const result = await uploadFile(
    file,
    UploadPurpose.REQUEST_PHOTO,
    undefined,
    (progress) => console.log(`Progress: ${progress}%`)
  );

  if (result.success) {
    console.log('URL:', result.publicUrl);
  } else {
    console.error('Error:', result.error);
  }
}
```

### 4. Provider Verification Upload

```tsx
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType } from '@/lib/upload';

function ProviderVerification() {
  return (
    <div>
      <FileUpload
        purpose={UploadPurpose.PROVIDER_VERIFICATION}
        docType={DocumentType.CITIZEN_ID_FRONT}
        label="CMND/CCCD - Mặt trước"
        onSuccess={(result) => {
          console.log('Citizen ID uploaded:', result.publicUrl);
        }}
      />
    </div>
  );
}
```

## 🎯 Upload Purposes

| Purpose | Description | Requires docType |
|---------|-------------|------------------|
| `provider_verification` | Xác minh nhà cung cấp | ✅ Yes |
| `request_photo` | Ảnh yêu cầu cứu hộ | ❌ No |
| `review_photo` | Ảnh đánh giá | ❌ No |
| `before_after` | Ảnh trước/sau | ❌ No |

## 📄 Document Types (for provider_verification)

| Type | Description |
|------|-------------|
| `citizenIdFront` | CMND/CCCD mặt trước |
| `citizenIdBack` | CMND/CCCD mặt sau |
| `selfie` | Ảnh selfie cầm CMND |
| `motorbikePhoto` | Ảnh phương tiện cứu hộ |

## 📏 Validation Rules

- **File size**: Maximum 5MB
- **File types**: `image/jpeg`, `image/png`, `image/webp`
- **Presign expiry**: 120 seconds
- **Ownership**: Chỉ owner mới có thể presign và confirm uploads của mình
- **Provider verification**: Chỉ users với role PROVIDER mới được upload verification documents

## 🔑 Object Key Convention

### Provider Verification
```
providers/{providerId}/verification/{docType}/{timestamp}_{random}.{ext}

Example:
providers/user123/verification/citizenIdFront/1704326400000_x8k2p9.jpg
```

### Request Photos
```
requests/{userId}/{timestamp}_{random}.{ext}

Example:
requests/user123/1704326400000_a5b3c7.jpg
```

### Review Photos
```
reviews/{userId}/{timestamp}_{random}.{ext}

Example:
reviews/user123/1704326400000_d9e2f1.jpg
```

### Before/After Photos
```
before-after/{userId}/{timestamp}_{random}.{ext}

Example:
before-after/user123/1704326400000_g4h5i6.jpg
```

## 🔐 API Endpoints

### POST /api/uploads/presign

Request presigned URL để upload file.

**Request Body:**
```json
{
  "purpose": "provider_verification",
  "docType": "citizenIdFront",
  "fileName": "citizen-id.jpg",
  "fileSize": 1024000,
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "uploadUrl": "https://...",
  "objectKey": "providers/user123/verification/citizenIdFront/...",
  "publicUrl": "https://cdn.rescue-me.com/providers/...",
  "uploadId": "upload123",
  "expiresIn": 120
}
```

### POST /api/uploads/confirm

Xác nhận upload đã thành công.

**Request Body:**
```json
{
  "uploadId": "upload123"
}
```

**Response:**
```json
{
  "success": true,
  "upload": {
    "id": "upload123",
    "objectKey": "providers/...",
    "publicUrl": "https://...",
    "fileName": "citizen-id.jpg",
    "fileSize": 1024000,
    "contentType": "image/jpeg",
    "createdAt": "2026-01-04T00:00:00.000Z"
  }
}
```

### GET /api/uploads

Lấy danh sách uploads của user.

**Query Parameters:**
- `purpose` (optional): Filter by upload purpose

**Response:**
```json
[
  {
    "id": "upload123",
    "purpose": "PROVIDER_VERIFICATION",
    "docType": "CITIZEN_ID_FRONT",
    "objectKey": "providers/...",
    "publicUrl": "https://...",
    "fileName": "citizen-id.jpg",
    "fileSize": 1024000,
    "contentType": "image/jpeg",
    "confirmed": true,
    "createdAt": "2026-01-04T00:00:00.000Z"
  }
]
```

## 🚀 Cloudflare R2 Setup

### 1. Create R2 Bucket

1. Go to Cloudflare Dashboard
2. Select "R2" from the sidebar
3. Click "Create bucket"
4. Name: `rescue-me-uploads`
5. Location: Choose closest to your users

### 2. Create API Token

1. Go to R2 → Manage R2 API Tokens
2. Click "Create API Token"
3. Permissions: "Object Read & Write"
4. Copy Access Key ID and Secret Access Key

### 3. Configure Public Access (Optional)

1. Go to bucket settings
2. Enable "Public access"
3. Configure custom domain or use R2.dev subdomain
4. Update `R2_PUBLIC_DOMAIN` in .env

### 4. CORS Configuration

Add CORS rules to allow direct uploads from frontend:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://rescue-me.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 🧪 Testing

### Test Upload Flow

1. Start backend: `cd backend && npm run start:dev`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to: `http://localhost:3000/examples/upload`
4. Try uploading different file types and sizes

### Test API Endpoints

```bash
# 1. Get access token (login first)
TOKEN="your_jwt_token"

# 2. Request presign URL
curl -X POST http://localhost:3001/api/uploads/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "request_photo",
    "fileName": "test.jpg",
    "fileSize": 100000,
    "contentType": "image/jpeg"
  }'

# 3. Upload file to R2 (use uploadUrl from response)
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg

# 4. Confirm upload
curl -X POST http://localhost:3001/api/uploads/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "UPLOAD_ID"}'

# 5. List uploads
curl http://localhost:3001/api/uploads \
  -H "Authorization: Bearer $TOKEN"
```

## 🛠️ Troubleshooting

### Upload fails with CORS error

- Check CORS configuration in R2 bucket
- Ensure frontend URL is in allowed origins
- Verify `AllowedMethods` includes `PUT`

### Presigned URL expired

- Default expiry is 120 seconds
- Upload file within 2 minutes of getting presigned URL
- Reduce file size or increase expiry time

### File too large

- Maximum allowed: 5MB
- Compress images before uploading
- Consider using image optimization service

### Upload succeeds but confirm fails

- Check if upload record exists in DB
- Verify ownership (userId matches)
- Ensure upload not already confirmed

## 📚 Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)

## 📄 License

MIT
