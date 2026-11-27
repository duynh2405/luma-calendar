# Tình trạng dự án

**Cập nhật:** 27/11/2026 · **Milestone:** M2 – Lặp lại + Công việc + Hôm nay · **Trạng thái:** chờ chủ sản phẩm kiểm thử
(M1 đã được chủ sản phẩm xác nhận.)

## Đã xong (M2)
- **Sự kiện lặp lại:** hằng ngày / tuần (nhiều thứ) / T2–T6 / tháng (theo ngày hoặc "thứ X tuần n", "cuối tháng") / năm,
  khoảng lặp tùy chỉnh, kết thúc theo ngày hoặc số lần. Hiển thị trong mọi chế độ xem.
- **Lặp theo âm lịch:** hằng tháng âm (mặc định tính cả tháng nhuận) và hằng năm âm (mặc định bỏ tháng nhuận);
  ngày 30 của tháng thiếu → ngày 29; chuỗi bắt đầu trong tháng nhuận lặp ở tháng thường.
- **Sửa / kéo / xóa một lần lặp:** hỏi "Chỉ sự kiện này / Sự kiện này và các sự kiện sau / Tất cả".
- **Công việc:** Inbox, Hôm nay (gồm quá hạn), Sắp tới, Tất cả, Đã hoàn thành, theo danh mục; ưu tiên, trạng thái,
  ngày bắt đầu, hạn chót (+ giờ), dự kiến, tiến độ tự tính (ghi đè được), danh sách kiểm, việc con, lặp lại
  (hoàn thành → chuyển sang hạn kế tiếp, lưu lịch sử), **lên lịch làm** (khối thời gian trên lịch, giữ nguyên hạn chót).
- Task có hạn hiện trên lịch (dải cả ngày / ô tháng / lịch trình), tick hoàn thành ngay trên lịch, kéo để dời hạn.
- **Màn Hôm nay:** ngày dương + âm + Can Chi + ngày lễ, ô tạo nhanh, sự kiện tiếp theo (đếm ngược),
  lịch hôm nay, khoảng trống trong giờ làm, việc hôm nay + tiến độ, ưu tiên cao, 7 ngày tới, chưa lên lịch.
- **Tạo nhanh tiếng Việt:** hiểu ngày (mai, mốt, thứ Hai tuần sau, 5/12, ngày 15, cuối tuần), giờ & khoảng giờ có buổi
  (7h sáng, 2 chiều, 8–12h), ngày âm, lặp (hằng ngày/tuần/tháng/năm, mỗi thứ 2), nhắc (trước 1 ngày, 2 tiếng),
  `#danh-mục`, `!1–!3`, "tại …". Hiện các phần đã hiểu dạng chip; chỗ đoán phải nhấn Enter lần 2.
- **Tìm kiếm** (Ctrl+K hoặc `/`) có dấu / không dấu trên sự kiện và công việc.
- Điều hướng mới: sidebar (Hôm nay · Lịch · Công việc), thanh tab dưới trên điện thoại; phím 1/2/3.
- Thùng rác có công việc; sao lưu JSON schema 2 (vẫn nhập được file schema 1).

## Đã tự kiểm thử
- **Tự động:** 186 test (lịch âm, lặp lại, sửa theo phạm vi, parser tạo nhanh với các câu ví dụ của chủ sản phẩm,
  task, store), typecheck, lint (0 cảnh báo), build web production.
- **Trình duyệt (Chrome 1440×900 và 375×812):** tạo bằng 5 câu tiếng Việt khác nhau (gồm câu mơ hồ cần xác nhận) ·
  sự kiện lặp hằng tuần hiện đúng các tuần · kéo một lần lặp → "Chỉ sự kiện này" (tuần sau không đổi) ·
  kéo → "Sự kiện này và các sự kiện sau" (các tuần sau đổi, lần đã sửa riêng giữ nguyên) · form của một lần lặp
  hiện "Thuộc chuỗi lặp" + "Sửa cả chuỗi" · tạo task, danh sách kiểm, việc con, tiến độ tự tính (33%) ·
  lên lịch làm · tìm "thiet bi" không dấu · màn Hôm nay trên desktop và điện thoại.

## Lỗi phát hiện & đã sửa trong lúc làm
- Parser hiểu "chị **Mai**" là "ngày mai" → thêm quy tắc tên người.
- Màn cũ vẫn mount khi chuyển màn → hai hộp thoại, phím tắt chạy hai lần (Ctrl+Z có thể hoàn tác 2 bước).
  Đã chuyển sang thay thế màn (replace) + chỉ màn đang hiện nghe phím.
- Gọi `Date.now()` trong lúc render (React Compiler) → đưa thời gian vào state.
- Selector trả mảng mới mỗi lần render (nguy cơ render vô hạn) → dùng useMemo.

## Chưa làm / giới hạn đã biết
- Nhắc nhở mới **được lưu** (từ tạo nhanh) nhưng **chưa gửi thông báo** — làm ở M4.
- Chưa có giao diện thêm nhắc nhở trong form sự kiện/công việc (sẽ làm cùng M4).
- Sửa quy tắc lặp của một lần lặp phải qua "Sửa cả chuỗi" (áp cho cả chuỗi).
- Liên kết sự kiện ↔ việc chuẩn bị/hậu kỳ: dữ liệu đã có, giao diện tạo liên kết chưa có (dự kiến M6 cùng template).
- Kéo task từ danh sách thả vào lịch chưa có (dùng nút "Lên lịch làm").
- Lịch ngày lễ chưa bật/tắt từng ngày (chỉ bật/tắt chung).
- Kéo thả cảm ứng, vuốt đổi ngày trên điện thoại: M6. Tooltip trên web chưa hiện.
- Dữ liệu vẫn chỉ ở trình duyệt (đồng bộ ở M3) → nhớ xuất JSON.

## Rủi ro
- Chuỗi lặp rất dài + nhiều ngoại lệ chưa đo hiệu năng trên máy yếu.
- Parser chỉ hiểu các mẫu câu đã viết luật; câu lạ sẽ thành tiêu đề nguyên văn (an toàn nhưng cần sửa tay).

## Thao tác chủ sản phẩm cần kiểm tra
1. Màn **Hôm nay**: có đúng thứ bạn cần xem mỗi sáng không? Thiếu/thừa khối nào?
2. Gõ tạo nhanh 10–20 câu theo cách bạn hay nói (ghi lại câu nào hiểu sai để mình bổ sung luật).
3. Tạo sự kiện lặp: họp hằng tuần, giỗ theo âm lịch (ví dụ "giỗ ông 10/3 âm hằng năm"), mùng 1 & rằm hằng tháng.
4. Kéo / sửa / xóa một lần lặp với cả ba lựa chọn phạm vi.
5. Màn **Công việc**: Inbox → phân loại, đặt hạn, việc con, danh sách kiểm, việc lặp (hoàn thành xem hạn tự nhảy).
6. "Lên lịch làm" cho một việc rồi xem trên lịch; tick việc ngay trên lịch.
7. Tìm kiếm (Ctrl+K) gõ không dấu.
8. Trên điện thoại: tab dưới, nút +, mở/sửa sự kiện và công việc.
