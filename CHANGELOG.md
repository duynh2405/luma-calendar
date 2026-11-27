# Changelog

## [Chưa phát hành] – phản hồi sau M2

### Thêm
- Khối chi tiết ngày ở cột trái: tab Dương lịch (thứ, ngày trong năm, tuần) và Âm lịch (ngày/tháng/năm âm, Can Chi ngày-tháng-năm, tháng đủ/thiếu), kèm lễ và lịch trong ngày.
- Nhập task bằng giọng nói (web): nói theo mẫu "Việc …, hạn …, ưu tiên …, danh mục …, nhắc trước …" → app điền sẵn để bạn lưu. Parser hiểu thêm "3 giờ chiều", "3 giờ rưỡi".
- M3 (đang làm): đồng bộ Supabase — schema + RLS đã áp dụng, engine đồng bộ + hợp nhất theo trường, đăng nhập bằng mã email trong Cài đặt.
- Giao diện mới: bảng màu ấm, dịu; ngày âm màu vàng đồng, tách khỏi ngày dương. Giờ làm việc mặc định 5h–23h.
- Nút **Xong việc** cho sự kiện (trong form sửa và dấu tick ở màn Hôm nay): sự kiện bị gạch ngang và mờ trên mọi chế độ xem; bấm lại để bỏ đánh dấu. Với sự kiện lặp, chỉ đánh dấu đúng lần đó.
- Ngày đang chọn được tô sáng (viền + nền) ở lưới Tháng, cột Tuần/3 ngày và lịch nhỏ; bấm ô ngày trống cũng chọn ngày đó.

## [0.2.0] – 2026-11-27 — M2 Lặp lại + Công việc + Hôm nay

### Thêm
- Sự kiện lặp lại (RFC 5545: ngày/tuần/tháng/năm, khoảng, kết thúc theo ngày/số lần) và lặp theo âm lịch (tháng/năm, quy tắc tháng nhuận & ngày 30).
- Sửa/kéo/xóa một lần lặp với phạm vi: chỉ lần này / lần này và các lần sau / tất cả.
- Công việc: Inbox, Hôm nay, Sắp tới, Tất cả, Đã hoàn thành, theo danh mục; ưu tiên, trạng thái, ngày bắt đầu/hạn chót/giờ hạn, dự kiến, tiến độ, danh sách kiểm, việc con, lặp lại, lịch sử hoàn thành, lên lịch làm (khối thời gian).
- Task có hạn hiện và kéo được trên lịch; tick hoàn thành trên lịch.
- Màn Hôm nay (sự kiện tiếp theo, lịch hôm nay, khoảng trống, việc hôm nay, ưu tiên cao, 7 ngày tới).
- Tạo nhanh bằng câu tiếng Việt (không dùng AI), xem trước dạng chip, xác nhận chỗ đoán.
- Tìm kiếm có dấu/không dấu (Ctrl+K, /).
- Sidebar điều hướng, thanh tab dưới cho điện thoại, phím 1/2/3.
- Sao lưu JSON schema 2 (kèm công việc), thùng rác có công việc.

### Sửa
- Phím tắt và hộp thoại có thể chạy hai lần khi chuyển màn.

## [0.1.0] – 2026-11-27 — M1 Calendar Core (web)

### Thêm
- Engine âm lịch Việt Nam (UTC+7, thuật toán Hồ Ngọc Đức), Can Chi, ngày lễ truyền thống & quốc gia; công cụ đổi ngày âm ↔ dương.
- Chế độ xem Ngày, 3 ngày, Tuần, Tháng, Lịch trình; mini calendar; vạch giờ hiện tại; tô vùng ngoài giờ làm việc.
- Tạo/sửa/xóa/nhân bản sự kiện; sự kiện cả ngày, nhiều ngày, qua đêm; màu theo lịch hoặc riêng; cảnh báo trùng giờ.
- Chuột: bấm/kéo để tạo, kéo để dời ngày giờ, kéo mép dưới để đổi thời lượng; kéo trong xem Tháng và dải "Cả ngày".
- Nhiều lịch: tạo, sửa, màu, icon, ẩn/hiện, chỉ hiện một lịch, sắp xếp, lịch mặc định, lưu trữ, xóa (vào thùng rác).
- Thùng rác (khôi phục / xóa vĩnh viễn có xác nhận), Hoàn tác (Ctrl+Z / toast).
- Cài đặt: ngôn ngữ VI/EN, sáng/tối, múi giờ, tuần bắt đầu, 12h/24h, giờ làm việc, ẩn cuối tuần, bật/tắt âm lịch & ngày lễ.
- Ô nhập ngày giờ hiểu "7h30", "19.30", "2 chiều", "25/11".
- Xuất/nhập JSON (không tạo bản trùng khi nhập lại).
- Phím tắt: C, T, D/X/W/M/A, J/K, ←/→, Ctrl+Z, Delete, Esc.
- Giao diện co giãn: desktop (sidebar + panel), tablet, điện thoại (drawer, nút tạo nổi, sheet).
