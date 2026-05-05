---
name: slide content rescueme
overview: "Tạo file markdown docs/slide-content.md chứa nội dung slide thuyết trình dự án RescueMe (~18 slides, bullet points ngắn gọn) cho 5 phần: giới thiệu, công nghệ, nghiệp vụ chính và cách giải quyết, kết quả đạt được, và tự đánh giá."
todos:
  - id: write-slide-md
    content: Tạo docs/slide-content.md với 18 slide theo cấu trúc 5 phần A-E, bullet points ngắn gọn tiếng Việt
    status: completed
isProject: false
---

## 1. File sẽ tạo

- [docs/slide-content.md](docs/slide-content.md) — file markdown duy nhất, mỗi slide phân cách bằng `---`, tiêu đề slide là `## Slide X — ...`. Ngôn ngữ: tiếng Việt.

## 2. Cấu trúc slide (~18 slides)

### Phần A — Giới thiệu đề tài (Slides 1–3)
- **Slide 1 — Trang bìa**: Tên đề tài "RescueMe — Nền tảng web kết nối dịch vụ cứu hộ phương tiện", thông tin sinh viên/GVHD (để trống cho bạn điền).
- **Slide 2 — Bối cảnh & Vấn đề**: Khó khăn khi xe hỏng giữa đường, thị trường cứu hộ phân mảnh, thiếu minh bạch về giá/thời gian, khó tìm đối tác uy tín.
- **Slide 3 — Mục tiêu đề tài**: Xây dựng web platform 3 vai trò (Khách hàng / Nhà cung cấp / Admin), hỗ trợ đặt yêu cầu cứu hộ nhanh cả khi chưa đăng nhập (guest), đấu giá ngược (quote) để có giá minh bạch, thanh toán & dispute end-to-end.

### Phần B — Công nghệ sử dụng (Slides 4–5)
Nguồn: `backend/package.json`, `frontend/package.json`, `docker-compose.prod.yml`, `nginx/`.

- **Slide 4 — Stack backend & hạ tầng**:
  - Backend: NestJS 10 + TypeScript, Prisma ORM + PostgreSQL
  - Auth: JWT (passport-jwt), Google OAuth 2.0, Firebase Admin (OTP guest qua SĐT)
  - AI: OpenAI SDK cho chatbot với tool-calling (`chatbot/tool-executor.service.ts`)
  - Bản đồ: VietMap API (geocoding + routing)
  - Storage: Cloudflare R2 (S3 SDK) + Cloudinary
  - Payment: SePay webhook (QR banking tự động đối soát)
  - Email: Nodemailer + Handlebars templates
  - DevOps: Docker, docker-compose, Nginx reverse proxy
- **Slide 5 — Stack frontend**:
  - Next.js 16 (App Router) + React 19 + TypeScript
  - TailwindCSS 4, Framer Motion, Lucide/Heroicons
  - React Hook Form + Zod (validation)
  - VietMap GL JS (bản đồ tương tác)
  - Firebase Web SDK (OTP), @react-oauth/google
  - Axios, react-hot-toast, jwt-decode

### Phần C — Các bài toán nghiệp vụ & cách giải quyết (Slides 6–11)
Nguồn: `docs/cdm.md`, `backend/src/app.module.ts`, các module tương ứng.

- **Slide 6 — Đa vai trò & Guest flow**:
  - Bài toán: 3 role (USER/PROVIDER/ADMIN) + guest chưa có tài khoản vẫn đặt cứu hộ được.
  - Giải pháp: 1 bảng `users` chia theo `role`, `GuestSession` riêng (SĐT + OTP Firebase, scoped JWT), cho phép convert guest → user sau khi hoàn thành.
- **Slide 7 — Vòng đời yêu cầu cứu hộ & matching**:
  - Bài toán: Ghép khách hàng với NCC phù hợp theo vị trí, loại xe, loại sự cố.
  - Giải pháp: State machine `CREATED → SEARCHING → MATCHED → EN_ROUTE → ARRIVED → WORKING → COMPLETED → PAID`; NCC submit `Quote` (tối đa 3/yêu cầu) với giá & ETA, khách hàng chọn; cron job auto-expire yêu cầu cũ.
- **Slide 8 — Thanh toán & ví escrow**:
  - Bài toán: Giảm rủi ro gian lận, hỗ trợ CASH / QR / WALLET.
  - Giải pháp: `Payment` 1-1 với request; tích hợp SePay webhook (idempotency theo `sepayId` + `transferCode`); `ProviderWallet` & `UserWallet` với `availableBalance`/`pendingBalance`, sổ cái `WalletTransaction` CREDIT/DEBIT, topup & rút tiền về tài khoản ngân hàng đã đăng ký.
- **Slide 9 — Khiếu nại (Dispute)**:
  - Bài toán: Xử lý tranh chấp sau thanh toán.
  - Giải pháp: `DisputeCase` với state `WAITING_FOR_PROVIDER/CUSTOMER → INVESTIGATING → RESOLVED/REJECTED`, thread message + evidence + read-state, SLA countdown phía FE, Admin ra quyết định `FULL_REFUND/PARTIAL/SPLIT/NO_REFUND`.
- **Slide 10 — Chatbot AI hỗ trợ**:
  - Bài toán: Hướng dẫn khách hàng/guest tạo yêu cầu nhanh, điền đủ trường.
  - Giải pháp: OpenAI + Tool Executor (`tool-executor.service.ts`) gọi trực tiếp vào service nội bộ (tạo request, xem trạng thái, gợi ý shop gần); `guided-missing-fields` phát hiện thiếu trường và nhắc người dùng.
- **Slide 11 — Bản đồ & định vị**:
  - Bài toán: Chọn vị trí sự cố, điều hướng NCC đến khách.
  - Giải pháp: VietMap GL JS cho pick điểm/tracking, backend gọi VietMap Routing API để tính ETA, NCC chia sẻ vị trí realtime khi online.

### Phần D — Kết quả đạt được (Slides 12–15)
Liệt kê chức năng từ `backend/src/*` modules, `frontend/app/*` routes, `frontend/components/*`, và `docs/test-plan.md` (181 test case, 13 suite).

- **Slide 12 — Chức năng Khách hàng & Guest**: đăng ký/đăng nhập email + Google, OTP SĐT cho guest, tạo yêu cầu cứu hộ kèm ảnh/video, xem quote & chọn NCC, theo dõi NCC trên bản đồ, thanh toán CASH/QR/Ví, đánh giá, mở dispute, chatbot.
- **Slide 13 — Chức năng Nhà cung cấp**: onboarding & upload giấy tờ verification, bật/tắt online, nhận yêu cầu trong bán kính, submit quote, navigation đến khách, xác nhận đến nơi/đang làm/hoàn thành, ví + topup + withdraw, lịch sử & thống kê.
- **Slide 14 — Chức năng Admin**: duyệt NCC, quản lý user/provider/ban, quản lý dispute & ra quyết định hoàn tiền, duyệt yêu cầu rút tiền, cấu hình phí nền tảng (FeeAuditLog), bản đồ sự cố tổng thể, dashboard biểu đồ doanh thu/giao dịch.
- **Slide 15 — Chất lượng & Phi chức năng**: 181 unit test (Jest), Swagger API docs, dockerize FE + BE + Nginx, CDM/PDM/Sequence/PlantUML trong `docs/`, hỗ trợ đa ngôn ngữ (vi/en) ở FE.

### Phần E — Tự đánh giá (Slides 16–18)
- **Slide 16 — Điểm mạnh**: hoàn thiện end-to-end flow từ guest → request → match → payment → dispute; state machine rõ ràng; test coverage trên 13 module nghiệp vụ chính; tích hợp SePay thực tế; UX mobile-first.
- **Slide 17 — Hạn chế**: chưa có realtime socket (đang dùng polling), chưa có mobile app native, chưa có CI/CD tự động, chưa scale horizontally (single-instance), rule matching NCC còn đơn giản.
- **Slide 18 — Hướng phát triển**: WebSocket/FCM push cho matching & chat, mobile app React Native, thuật toán matching theo ML (dựa trên lịch sử, rating), mở rộng dispute với trọng tài bên thứ 3, tách microservices cho wallet/payment.

## 3. Điều tôi sẽ KHÔNG làm
- Không chèn tên sinh viên/GVHD cụ thể (để placeholder `[Họ tên sinh viên]`, `[GVHD]` cho bạn điền).
- Không tạo file `.pptx` binary — chỉ markdown để bạn copy sang PowerPoint/Google Slides.
- Không sửa code dự án.
