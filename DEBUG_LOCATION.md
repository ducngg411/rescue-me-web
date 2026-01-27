# 🔍 Debug Vấn Đề Định Vị

## Vấn đề hiện tại
Ứng dụng luôn lấy về một vị trí cố định (21.168847, 105.837878) bất kể vị trí thực tế của người dùng.

## ✅ Đã sửa
1. **LocationPicker.tsx** - Thêm `maximumAge: 0` để không dùng cache
2. **user/page.tsx** - Thêm `maximumAge: 0` và logs chi tiết
3. **create-request/page.tsx** - Đã có `maximumAge: 0` từ trước

## 🔎 Cách kiểm tra

### Bước 1: Xóa cache permission của browser
1. **Chrome/Edge:**
   - Mở DevTools (F12)
   - Vào tab **Application** → **Storage** → **Clear site data**
   - Hoặc Settings → Privacy → Site Settings → Location → Xóa localhost

2. **Firefox:**
   - Settings → Privacy & Security → Permissions → Location → Settings → Xóa localhost

3. **Safari:**
   - Safari → Preferences → Websites → Location → Xóa localhost

### Bước 2: Reset location permission
1. Click vào icon 🔒 bên trái URL bar
2. Chọn **Site settings** hoặc **Permissions**
3. Tìm **Location** → chọn **Ask** (hoặc **Allow**)
4. Reload trang

### Bước 3: Kiểm tra console logs
Mở DevTools Console (F12) và tìm các log:

**Khi thành công:**
```
🔍 [GEOLOCATION] Requesting new position...
✅ [GEOLOCATION] Position received: { lat: ..., lng: ..., accuracy: ... }
📍 [GEOLOCATION] Final location: { ... }
```

**Khi lỗi:**
```
❌ [GEOLOCATION] Error: { code: 1, message: "User denied Geolocation" }
```

### Bước 4: Kiểm tra HTTPS
Geolocation API chỉ hoạt động đầy đủ trên:
- HTTPS
- localhost (HTTP OK)

Nếu chạy trên HTTP (không phải localhost) → sẽ bị lỗi

### Bước 5: Test trực tiếp trong Console
Paste code này vào DevTools Console:

```javascript
navigator.geolocation.getCurrentPosition(
  (pos) => console.log('✅ Vị trí:', pos.coords.latitude, pos.coords.longitude, 'Độ chính xác:', pos.coords.accuracy + 'm'),
  (err) => console.error('❌ Lỗi:', err.code, err.message),
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
);
```

## 🐛 Các trường hợp lỗi phổ biến

### Error Code 1: PERMISSION_DENIED
**Nguyên nhân:** Người dùng từ chối quyền truy cập vị trí
**Giải pháp:** 
- Reset permission như Bước 2
- Kiểm tra browser settings không block location

### Error Code 2: POSITION_UNAVAILABLE
**Nguyên nhân:** Thiết bị không thể xác định vị trí (GPS tắt, không có WiFi/cell tower)
**Giải pháp:**
- Bật Location Services trong hệ điều hành
- Bật WiFi để cải thiện độ chính xác
- Di chuyển ra ngoài trời nếu ở trong nhà

### Error Code 3: TIMEOUT
**Nguyên nhân:** Hết thời gian chờ (15s)
**Giải pháp:**
- Bật WiFi để tăng tốc độ định vị
- Kiểm tra kết nối mạng
- Tắt VPN nếu có

### Vị trí cố định không đổi
**Nguyên nhân:** Browser cache vị trí cũ
**Giải pháp:**
- Hard reload: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
- Xóa cache như Bước 1
- Thử incognito/private mode

## 📱 Test trên Mobile

### iOS Safari
1. Settings → Privacy → Location Services → ON
2. Settings → Safari → Location → Ask hoặc Allow
3. Reload trang và cho phép khi popup xuất hiện

### Android Chrome
1. Settings → Location → ON
2. Chrome → Settings → Site settings → Location → Ask before accessing
3. Reload trang và cho phép khi popup xuất hiện

## 🔧 Nếu vẫn không được

1. **Kiểm tra URL:**
   - Đang chạy trên `http://localhost:3000` ✅
   - Đang chạy trên `http://192.168.x.x:3000` ❌ (cần HTTPS)

2. **Kiểm tra browser support:**
   ```javascript
   console.log('Geolocation supported:', 'geolocation' in navigator);
   ```

3. **Kiểm tra permissions:**
   ```javascript
   navigator.permissions.query({ name: 'geolocation' }).then(result => {
     console.log('Permission state:', result.state); // "granted", "denied", or "prompt"
   });
   ```

4. **Force request permission lại:**
   - Xóa toàn bộ site data
   - Restart browser
   - Truy cập lại trang

## 📋 Checklist hoàn chỉnh
- [ ] Đã clear browser cache
- [ ] Đã reset location permission về "Ask"
- [ ] Đang chạy trên localhost hoặc HTTPS
- [ ] Location Services đã bật ở OS
- [ ] Đã hard reload trang (Ctrl+Shift+R)
- [ ] Đã kiểm tra console logs
- [ ] Đã test raw geolocation API trong console
- [ ] WiFi đã bật (để cải thiện độ chính xác)
- [ ] Không dùng VPN

## 🎯 Kết quả mong đợi
Sau khi làm theo các bước trên:
1. Trang sẽ hiện popup xin quyền location
2. Sau khi Allow, console sẽ log vị trí thực tế
3. Map sẽ hiển thị đúng vị trí hiện tại
4. Mỗi lần reload sẽ lấy vị trí mới (không dùng cache)
