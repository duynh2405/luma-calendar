# Kế hoạch kiểm thử

## Tự động (chạy `npm test`)
| Bộ test | Nội dung |
|---|---|
| `core/lunar/lunar.test.ts` | Tết VN 1968–2030 (gồm 1985, 2007, 2030 khác Trung Quốc), tháng nhuận 2001–2028, Trung Thu, Giỗ Tổ, Rằm tháng Giêng, độ dài tháng, ngày 30 không tồn tại, **khứ hồi dương→âm→dương mọi ngày 1900–2100**, đối chiếu lịch Trung Quốc 1968–2100, Can Chi, hồi quy lỗi "ngày 0" |
| `core/time/*.test.ts` | Cộng ngày qua năm nhuận, đầu tuần, lưới tháng, múi giờ VN, DST (Berlin), định dạng 12/24h, phân tích giờ/ngày gõ tay |
| `core/layout/layout.test.ts` | Phân loại cả ngày/≥24h, tách sự kiện qua đêm, xếp cột sự kiện chồng giờ, xếp làn thanh nhiều ngày, ẩn cuối tuần, phát hiện trùng |
| `core/model/*.test.ts` | UUIDv7, validate, chuyển đổi form↔sự kiện, dời sự kiện, sao lưu không tạo trùng, chỉ ghi đè khi mới hơn |
| `core/recurrence/*.test.ts` | Ngày/tuần/tháng/năm, ngày 31, thứ n & cuối tháng, 29/2, COUNT/UNTIL, lặp âm lịch (tháng nhuận, ngày 30), bung lặp với exdate & ngoại lệ, sửa/xóa theo 3 phạm vi |
| `core/nlp/quickadd.test.ts` | 5 câu ví dụ của chủ sản phẩm, ngày tương đối, giờ & khoảng giờ có buổi, ngày âm, lặp, nhắc, #danh mục, !ưu tiên, tên người "Mai", "tài liệu" không phải địa điểm |
| `data/store.test.ts` | Lần đầu tạo đúng 1 lịch, lưu & nạp lại, xóa→thùng rác→hoàn tác, hoàn tác tạo xóa khỏi đĩa, xóa lịch kéo theo sự kiện & chuyển mặc định, xóa vĩnh viễn chỉ áp dụng mục trong thùng rác, công việc (hoàn thành, lặp, xóa kèm việc con), sự kiện lặp theo phạm vi, lên lịch làm |

Kiểm tra tĩnh: `npm run typecheck`, `npm run lint` (gồm luật React Compiler).

## Thủ công (trình duyệt) — M1
Xem danh sách thao tác trong `PROJECT_STATUS.md`. Thiết bị: Chrome desktop, Chrome Android (web), Safari iOS (web).

## Sẽ bổ sung
- M2: test RRULE (DST, ngoại lệ, sửa "các lần sau"), lặp âm lịch (tháng nhuận, ngày 30), parser tiếng Việt (hàng trăm câu).
- M3: test 2 thiết bị offline sửa chéo, RLS (pgTAP), mất mạng giữa chừng.
- M4: thông báo — khởi động lại máy, app bị tắt, đổi múi giờ, sửa/xóa sự kiện có nhắc, Xiaomi/Oppo.
- E2E: Playwright (web), Maestro (mobile).
