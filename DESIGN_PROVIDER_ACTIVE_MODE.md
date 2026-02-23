# Provider Active Mode UI/UX Design

## 📋 Overview
Giao diện Provider khi **BẬT TRẠNG THÁI HOẠT ĐỘNG** - tối ưu cho thao tác nhanh, nhận requests và phản hồi trong thời gian thực.

---

## 🎯 User Flow

```
Provider Dashboard (Offline) 
    ↓ Bật toggle "Online"
Provider Active Mode (Online)
    ↓ Có request mới matching
Incoming Request Alert (Popup/Notification)
    ↓ Provider xem + quyết định
    ├─ Accept → Chuyển sang Request Detail + Navigation
    └─ Decline → Quay lại Active Mode
```

---

## 🔐 Điều Kiện Truy Cập

### Provider phải:
1. ✅ `verificationStatus` = `APPROVED`
2. ✅ `role` = `PROVIDER`
3. ✅ Profile đã hoàn chỉnh (serviceName, serviceTypes, pricing, etc.)

### Nếu chưa đủ điều kiện:
- Hiện banner "Bạn cần hoàn thành xác minh trước khi nhận requests"
- Nút "Hoàn thiện hồ sơ" → redirect to verification page

---

## 🎨 UI Components

### 1. Header - Online/Offline Toggle
**Position**: Fixed top, luôn hiển thị

```
┌─────────────────────────────────────────┐
│ 🚛 Rescue Me Provider                   │
│                                         │
│  Online  ●───────○  [Profile] [Menu]   │
│  Offline                                │
└─────────────────────────────────────────┘
```

**States**:
- **OFF (Gray)**: isOnline = false, không nhận requests
- **ON (Green)**: isOnline = true, sẵn sàng nhận requests

**Behavior**:
- Toggle → API call: `PATCH /provider/status`
- Success → UI update + show toast "Bạn đang online"
- Error → rollback toggle + show error message

---

### 2. Dashboard - Offline State
**Khi isOnline = false**

```
┌─────────────────────────────────────────┐
│                                         │
│       🔴 Bạn đang ngoại tuyến            │
│                                         │
│   Bật "Online" để bắt đầu nhận          │
│   yêu cầu cứu hộ từ khách hàng          │
│                                         │
│   ┌─────────────────────────────┐       │
│   │  Bật trạng thái Online      │       │
│   └─────────────────────────────┘       │
│                                         │
│   📊 Thống kê hôm nay:                  │
│   • Requests hoàn thành: 5              │
│   • Doanh thu: 2,500,000 VNĐ            │
│   • Đánh giá trung bình: 4.8 ⭐         │
│                                         │
└─────────────────────────────────────────┘
```

---

### 3. Dashboard - Online State (No Requests)
**Khi isOnline = true, chưa có requests matching**

```
┌─────────────────────────────────────────┐
│   🟢 Bạn đang Online                     │
│   Sẵn sàng nhận yêu cầu cứu hộ           │
│                                         │
│   ┌─────────────────────────────┐       │
│   │                             │       │
│   │    Đang chờ requests...     │       │
│   │                             │       │
│   │        ⏳ Loading...        │       │
│   │                             │       │
│   └─────────────────────────────┘       │
│                                         │
│   📍 Khu vực phục vụ:                   │
│   • Bán kính: 15 km                     │
│   • Từ: 123 Nguyễn Văn Linh, Q7        │
│                                         │
│   💰 Giá dịch vụ hiện tại:              │
│   • Phí cơ bản: 50,000 VNĐ              │
│   • Giá/km: 10,000 VNĐ                  │
│                                         │
└─────────────────────────────────────────┘
```

**Real-time polling**:
- Mỗi 5 giây: `GET /provider/pending-requests`
- Nếu có request matching → hiện Alert

---

### 4. Incoming Request Alert (Modal/Bottom Sheet)
**Khi có request matching với provider**

```
┌─────────────────────────────────────────┐
│  🚨 YÊU CẦU CỨU HỘ MỚI                   │
├─────────────────────────────────────────┤
│                                         │
│  👤 Nguyễn Văn A                        │
│  📞 0901234567                          │
│                                         │
│  📍 Vị trí gặp nạn:                     │
│  123 Lê Văn Việt, Q9, TP.HCM            │
│  🗺️ [Xem bản đồ]                        │
│                                         │
│  🚗 Loại xe: Ô tô                       │
│  🔧 Sự cố: Hỏng xe                      │
│  📝 "Xe đột ngột tắt máy, không nổ lại" │
│                                         │
│  📏 Khoảng cách: 3.5 km (~8 phút)       │
│  💵 Dự kiến: 85,000 VNĐ                 │
│                                         │
│  ⏱️ Thời gian phản hồi: 00:45           │
│  [████████████░░░░░░] 45s còn lại       │
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │   ❌ Từ chối │  │ ✅ Nhận ngay │       │
│  └─────────────┘  └─────────────┘       │
│                                         │
└─────────────────────────────────────────┘
```

**Auto-close**: 60 giây (countdown timer)
**Sound**: Notification sound khi xuất hiện
**Vibration**: Rung nhẹ 2 lần

**Actions**:
- **Từ chối**: `POST /provider/requests/:id/decline` → quay lại Active Mode
- **Nhận ngay**: `POST /provider/requests/:id/accept` → chuyển Request Detail

---

### 5. Active Request View (Sau khi Accept)
**Provider đã nhận, đang thực hiện**

```
┌─────────────────────────────────────────┐
│  ← Quay lại          ĐANG THỰC HIỆN     │
├─────────────────────────────────────────┤
│                                         │
│  🎯 Yêu cầu #cmkw7rga...                │
│  ⏱️ Đã nhận: 2 phút trước               │
│                                         │
│  👤 Khách hàng: Nguyễn Văn A            │
│  📞 [0901234567] [📱 Gọi điện]          │
│                                         │
│  📍 Vị trí khách hàng:                  │
│  ┌─────────────────────────────┐       │
│  │                             │       │
│  │    [Google Maps Embed]      │       │
│  │    📍 Marker: Khách hàng     │       │
│  │    🚛 Marker: Vị trí bạn     │       │
│  │                             │       │
│  └─────────────────────────────┘       │
│  📏 3.5 km | 🕐 8 phút                  │
│                                         │
│  ┌─────────────────────────────┐       │
│  │  🗺️ Chỉ đường (Google Maps) │       │
│  └─────────────────────────────┘       │
│                                         │
│  📝 Chi tiết sự cố:                     │
│  • Loại xe: Ô tô                        │
│  • Vấn đề: Hỏng xe                      │
│  • Mô tả: "Xe đột ngột tắt máy..."      │
│                                         │
│  🎥 Hình ảnh/Video: [3 files]           │
│  [🖼️] [🖼️] [🎬]                        │
│                                         │
│  ┌─────────────────────────────┐       │
│  │  ✅ Đánh dấu hoàn thành      │       │
│  └─────────────────────────────┘       │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📱 Mobile-Optimized Features

### Bottom Navigation (Provider Active Mode)
```
┌─────────────────────────────────────────┐
│  🏠 Home  │  📋 Requests  │  👤 Profile │
└─────────────────────────────────────────┘
```

### Floating Action Button (FAB)
**Position**: Bottom-right corner
**Action**: Tắt/bật online status nhanh

---

## 🔔 Notification Strategy

### Push Notifications (khi app ở background)
```
🚨 Yêu cầu cứu hộ mới!
📍 3.5 km từ bạn • 85,000 VNĐ
Nhấn để xem chi tiết
```

### In-App Notifications (khi app ở foreground)
- Modal/Bottom Sheet (thiết kế ở trên)
- Sound + Vibration

---

## 🛠️ Technical Implementation

### 1. Backend Endpoints

#### Toggle Online Status
```
PATCH /api/provider/status
Body: { isOnline: boolean }
Response: { success: true, isOnline: true }
```

#### Get Pending Requests (Polling)
```
GET /api/provider/pending-requests
Response: [
  {
    id: "cmkw7rga...",
    user: { name: "Nguyễn Văn A", phone: "0901234567" },
    incidentType: "BREAKDOWN",
    vehicleType: "CAR",
    pickupLocation: { lat, lng, address },
    description: "...",
    distance: 3.5,
    estimatedEarnings: 85000,
    expiresAt: "2026-01-27T...",
    timeRemaining: 45
  }
]
```

#### Accept Request
```
POST /api/provider/requests/:id/accept
Response: { success: true, request: {...} }
```

#### Decline Request
```
POST /api/provider/requests/:id/decline
Response: { success: true }
```

### 2. Frontend Components

**File Structure**:
```
frontend/app/provider/
  ├── active/
  │   ├── page.tsx              # Main Active Mode page
  │   └── components/
  │       ├── OnlineToggle.tsx  # Toggle online/offline
  │       ├── WaitingState.tsx  # "Đang chờ requests..."
  │       ├── IncomingRequestModal.tsx # Alert popup
  │       └── ActiveRequestView.tsx    # Request detail
  └── hooks/
      ├── useProviderStatus.ts  # Hook toggle online
      └── usePendingRequests.ts # Hook poll requests
```

### 3. Real-time Strategy

**Option 1: Polling (Simple)**
- Mỗi 5 giây: `GET /pending-requests`
- Stop polling khi offline

**Option 2: WebSocket (Advanced)**
- Server push when new request matches
- No polling needed

---

## ✅ Acceptance Criteria

### Provider phải có khả năng:
1. ✅ Bật/tắt online status dễ dàng (1 click)
2. ✅ Thấy thông báo rõ ràng khi có request mới
3. ✅ Accept/Decline trong 60 giây
4. ✅ Xem vị trí khách hàng trên bản đồ
5. ✅ Gọi điện cho khách hàng trực tiếp
6. ✅ Chỉ đường đến vị trí khách hàng
7. ✅ Đánh dấu hoàn thành khi xong việc

---

## 🎨 Color Scheme

**Online State**: Green (#10B981)
**Offline State**: Gray (#6B7280)
**Alert/Urgent**: Red (#EF4444)
**Primary Action**: Blue (#3B82F6)

---

## 📝 Next Steps

1. ✅ Implement backend endpoints
2. ✅ Create UI components
3. ✅ Test online/offline flow
4. ✅ Implement request matching logic
5. ✅ Add Google Maps integration
6. ✅ Test end-to-end with real requests

---

**Created**: 2025-01-27  
**Status**: Design Ready - Ready for Implementation  
**Priority**: High (Core Provider Feature)
