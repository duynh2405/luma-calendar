# Tình trạng dự án

**Cập nhật:** 27/11/2026 · **Milestone:** M1 – Calendar Core · **Trạng thái:** chờ chủ sản phẩm kiểm thử

## Đã xong (M1)
- Engine âm lịch + Can Chi + ngày lễ + công cụ đổi ngày (118 test tự động đạt).
- Xem Ngày / 3 ngày / Tuần / Tháng / Lịch trình; mini calendar; vạch giờ hiện tại; vùng ngoài giờ làm việc.
- Sự kiện: tạo/sửa/xóa/nhân bản, cả ngày, nhiều ngày, qua đêm, màu riêng, cảnh báo trùng giờ.
- Chuột: bấm/kéo tạo, kéo dời, kéo giãn thời lượng; kéo trong xem Tháng & dải Cả ngày.
- Nhiều lịch (màu, icon, ẩn/hiện, chỉ hiện 1 lịch, thứ tự, mặc định, lưu trữ, xóa).
- Thùng rác, Hoàn tác, Cài đặt, VI/EN, sáng/tối, xuất/nhập JSON, phím tắt, giao diện điện thoại.

## Đã tự kiểm thử trên trình duyệt (Chrome, 1440×900 và 375×812)
Tạo bằng kéo · gõ tiêu đề + Enter lưu · kéo dời sang ngày khác + giờ khác · Ctrl+Z · kéo giãn · sửa giờ bằng "14h30" ·
thêm địa điểm · tạo sự kiện cả ngày 16/11→3/12 (thanh trải 3 tuần) · xem Tháng/Lịch trình · đổi âm→dương (Tết 2027 = 06/02/2027) ·
giao diện sáng · xóa bằng phím Delete → thùng rác → khôi phục · nạp lại trang dữ liệu còn nguyên · bố cục điện thoại + nút tạo.
Không có lỗi console. Build web production thành công.

## Chưa làm / giới hạn đã biết
- Chưa có: sự kiện lặp lại, task, nhắc nhở, đồng bộ (theo roadmap M2–M4).
- Kéo thả bằng cảm ứng chưa có (chạm để tạo/mở được). Vuốt đổi ngày trên điện thoại chưa có.
- Chuột phải chỉ có trên danh sách lịch (mở sửa lịch); menu chuột phải cho sự kiện chưa có.
- Tooltip (thuộc tính `title`) không hiện trên web do React Native Web không chuyển tiếp thuộc tính này.
- Bản Android/iOS chưa build; adapter lưu trữ native chưa chạy trên máy thật.
- Dữ liệu chỉ ở trình duyệt đang dùng → nhớ xuất JSON để sao lưu.
- "Xóa vĩnh viễn" vẫn hoàn tác được trong phiên hiện tại (chỉ mất hẳn sau khi tải lại trang).

## Rủi ro còn tồn tại
- Trình duyệt có thể xóa IndexedDB khi thiếu dung lượng (đã xin `persistent storage`, không đảm bảo 100%).
- Hiệu năng xem Tháng với rất nhiều sự kiện chưa đo (dữ liệu thật hiện còn ít).

## Thao tác chủ sản phẩm cần kiểm tra
1. Tạo vài lịch thật (Loa đài, Media, …): màu, icon, thứ tự, đặt mặc định, ẩn/hiện, giữ chuột để chỉ hiện 1 lịch.
2. Tạo sự kiện bằng: nút Tạo, phím C, bấm vào ô giờ, kéo một khoảng giờ, bấm ô trong xem Tháng.
3. Kéo dời sự kiện sang ngày/giờ khác; kéo mép dưới để đổi thời lượng; Ctrl+Z.
4. Sự kiện cả ngày nhiều ngày; sự kiện qua đêm (22:00 → 02:00 hôm sau).
5. Đối chiếu ngày âm với lịch giấy / lịch bạn tin cậy ở vài tháng (đặc biệt mùng 1, rằm, tháng nhuận 2028).
6. Cài đặt: tuần bắt đầu, 12h/24h, ẩn cuối tuần, giờ làm việc, tắt âm lịch, tiếng Anh, sáng/tối.
7. Xóa → Thùng rác → Khôi phục; xuất JSON rồi nhập lại (không được trùng).
8. Mở trên điện thoại (cùng mạng Wi-Fi) và xem bố cục.
