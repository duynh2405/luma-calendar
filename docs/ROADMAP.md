# Lộ trình

Mỗi milestone ra một bản chạy được. Chủ sản phẩm duyệt rồi mới chuyển milestone.
**MVP dùng hằng ngày = hết M4.**

| M | Nội dung | Trạng thái |
|---|---|---|
| M0 | Phân tích, chốt kiến trúc, mô hình dữ liệu, roadmap | ✅ Xong (27/11/2026) |
| **M1** | **Calendar Core (web, lưu cục bộ)**: khung app, design system, lịch âm + test, nhiều lịch, sự kiện (có giờ / cả ngày / nhiều ngày), xem Ngày · 3 ngày · Tuần · Tháng · Lịch trình, kéo thả chuột, cài đặt, thùng rác, Undo, xuất/nhập JSON | ✅ Đã xác nhận |
| **M2** | Lặp lại (RRULE: lần này / các lần sau / tất cả) + **lặp theo âm lịch**; Task, subtask, checklist, ưu tiên, trạng thái, Inbox; time-block; liên kết event↔task; màn **Hôm nay**; tạo nhanh tiếng Việt v1; tìm kiếm có dấu/không dấu; lịch ngày lễ dạng lịch bật/tắt | 🧪 Chờ kiểm thử (ICS chuyển sang M8, bật/tắt từng ngày lễ để sau) |
| M3 | Tài khoản + đồng bộ (Supabase Free), RLS + test, offline, xử lý xung đột, lịch sử phiên bản, PWA, sao lưu tự động | |
| M4 (đang làm: lõi nhắc việc + thông báo xong, chưa build APK) | Bản Android (APK), thông báo cục bộ, Web Push, nhắc nhiều mốc, snooze, nhắc deadline/quá hạn, tóm tắt ngày, giờ yên lặng, hướng dẫn tắt tối ưu pin → **chuyển hẳn khỏi Google Calendar** | |
| M5 | Timeline nhiều nhóm (zoom, kéo thả, mốc deadline, tiến độ), chế độ xem đã lưu, command palette, cảnh báo trùng mở rộng | |
| M6 | Quy trình sự kiện/Media: nhiều mốc giờ (tập trung/setup/show/thu dọn), trạng thái giữ lịch, template D±n, trường tùy chỉnh, khách hàng, tiền; chia sẻ lịch trình qua Zalo; tạo nhanh v2; kéo thả cảm ứng native | |
| M7 | iOS (PWA hoặc native), tinh chỉnh mobile, chia sẻ lịch / giao việc | |
| M8 | ICS nhập/xuất + feed đăng ký, widget Android/iOS, deep link | |
| M9 | Kiểm thử toàn diện, hiệu năng, tài liệu người dùng, phát hành | |

Đồng bộ nguồn ngoài (quyết định 27/11/2026, chỉ **một chiều: nguồn ngoài → Luma**, không làm hai chiều):
1. ✅ Nhập file .ics (Google/Apple/Outlook/Notion xuất được) thành lịch riêng, nhập lại không bị trùng.
2. ✅ Đăng ký link ICS tự cập nhật (6 giờ/lần, qua Edge Function ics-proxy nếu bị CORS).
3. Google Calendar + Google Tasks (đọc, OAuth, token lưu phía server) — sau M3/M4, bạn cần tạo OAuth client.

Đã bỏ khỏi lộ trình: quản lý tài nguyên thiết bị. (Tích hợp Google Calendar API được đưa trở lại theo hướng một chiều ở trên.)
