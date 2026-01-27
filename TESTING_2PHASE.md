# Testing 2-Phase Matching - Quick Guide

## Quick Start Test

### 1. Start Backend Server
```bash
cd c:\rescue-me-web\rescue-me-web\backend
npm run start:dev
```

### 2. Start Frontend Server
```bash
cd c:\rescue-me-web\rescue-me-web\frontend
npm run dev
```

### 3. Create Test Request

**Login as User** → Navigate to `/user/create-request`

Fill form:
- Incident Type: BREAKDOWN
- Vehicle Type: CAR
- Description: "Test 2-phase matching"
- Pick contact phone
- Select pickup/dropoff locations
- Upload media (optional)

Click "Tạo yêu cầu"

---

## What to Observe

### Phase 1 (First 60 seconds)
✅ **UI Elements:**
- Blue badge: "Đang tìm kiếm provider"
- Blue spinner animation
- Countdown: `01:00` → `00:01`
- Message: "Đang gửi yêu cầu tới providers gần bạn"
- Cancel button visible

✅ **Network (DevTools):**
```
GET /rescue-requests/:id/status
Response: { "status": "MATCHING", "searchPhase": 1, ... }
```

✅ **Backend Logs:**
```
✅ [RescueRequest] Created request: 123abc
🔍 [RescueRequest] Phase 1: MATCHING (normal radius)
```

### Phase 1 → Phase 2 Transition (at 00:00)
✅ **What Should Happen:**
- Cron job runs (every minute)
- `searchPhase` updates from 1 → 2
- `expiresAt` extends by 30 seconds
- UI auto-refetches status

✅ **UI Changes:**
- Badge color: Blue → **Orange**
- Spinner: Blue → **Orange**
- Message: "**Hiện chưa có cứu hộ gần bạn. Hệ thống đang mở rộng tìm kiếm…**"
- Countdown: `00:30` → `00:01`

✅ **Network:**
```
GET /rescue-requests/:id/status
Response: { "status": "MATCHING", "searchPhase": 2, ... }
```

✅ **Backend Logs:**
```
🔄 [RescueRequest] 123abc → Phase 2 (expanded search)
📊 [RescueRequest] Phase 1→2: 1, Phase 2→EXPIRED: 0
```

### Phase 2 → EXPIRED (after 30 more seconds)
✅ **UI Elements:**
- Red "X" icon
- Message: "Không tìm thấy provider"
- **Retry button**: "Thử lại"
- **Cancel button**: "Huỷ hoàn toàn"

✅ **Network:**
```
GET /rescue-requests/:id/status
Response: { "status": "EXPIRED", "searchPhase": 2, ... }
```

✅ **Backend Logs:**
```
⏰ [RescueRequest] 123abc → EXPIRED (no providers found after Phase 2)
📊 [RescueRequest] Phase 1→2: 0, Phase 2→EXPIRED: 1
```

---

## Manual Testing with Cron

### Trigger Cron Manually (Optional)
Instead of waiting for the cron schedule, force it to run:

```bash
curl -X POST http://localhost:3001/rescue-requests/admin/expire-check
```

**Expected Response:**
```json
{
  "phase1ToPhase2": 1,
  "phase2ToExpired": 0,
  "totalProcessed": 1
}
```

---

## Test Scenarios

### ✅ Scenario 1: Phase 1 → Phase 2 → EXPIRED
1. Create request
2. Wait for countdown to reach `00:00`
3. Observe UI change to orange (Phase 2)
4. Wait 30 more seconds
5. Observe UI change to red "EXPIRED"

**Expected Timeline:**
- 00:00 - 01:00: Phase 1 (Blue)
- 01:00 - 01:30: Phase 2 (Orange)
- 01:30: EXPIRED (Red)

### ✅ Scenario 2: Cancel During Phase 1
1. Create request
2. Wait ~30 seconds
3. Click "Huỷ yêu cầu"
4. Confirm cancel

**Expected:**
- Status: MATCHING → CANCELLED
- No Phase 2 transition
- Redirected to request list

### ✅ Scenario 3: Cancel During Phase 2
1. Create request
2. Wait for Phase 2 (orange UI)
3. Click "Huỷ yêu cầu"

**Expected:**
- Status: MATCHING (Phase 2) → CANCELLED
- No EXPIRED transition

### ✅ Scenario 4: Retry After EXPIRED
1. Wait for request to EXPIRE
2. Click "Thử lại"

**Expected:**
- New request created with same data
- New ID assigned
- Starts at Phase 1 again
- `matchAttempts` increments

---

## Troubleshooting

### Issue: UI doesn't change to orange at 00:00
**Possible causes:**
- Cron hasn't run yet (runs every minute)
- Backend server not running

**Fix:**
```bash
# Check backend logs
# Should see: "🔄 [RescueRequest] ... → Phase 2"

# Trigger manually
curl -X POST http://localhost:3001/rescue-requests/admin/expire-check
```

### Issue: Countdown shows negative time
**Possible causes:**
- `expiresAt` not updated by cron
- Frontend polling delay

**Fix:**
- Refresh page
- Check network tab for `/status` response
- Verify `searchPhase` and `expiresAt` values

### Issue: Build errors
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

**Expected:** 0 errors

---

## Success Criteria

- ✅ Phase 1 UI shows blue spinner + correct message
- ✅ Countdown timer works correctly (60s → 0s)
- ✅ Phase 1 → Phase 2 transition happens automatically
- ✅ Phase 2 UI shows orange spinner + expanded search message
- ✅ Phase 2 countdown shows 30 seconds
- ✅ Phase 2 → EXPIRED transition happens after 30s
- ✅ EXPIRED UI shows retry button
- ✅ Retry creates new request starting at Phase 1
- ✅ Cancel works in both phases
- ✅ Backend logs show correct phase transitions

---

## Next Steps After Testing

If all tests pass:
1. ✅ Deploy to staging/production
2. 📝 Update user documentation
3. 🔔 Add push notifications for Phase 2 (optional)
4. 📊 Monitor analytics: Phase 1 vs Phase 2 success rates

---

**Last Updated**: 2025-01-27  
**Status**: Ready for Testing
