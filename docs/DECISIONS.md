# Nhật ký quyết định (ADR)

Định dạng: bối cảnh → quyết định → hệ quả. Mới nhất ở cuối.

## ADR-001 · Expo + React Native Web (27/11/2026) — duyệt bởi chủ sản phẩm
So với Flutter (web desktop yếu, Dart khó bảo trì bằng AI) và React + Capacitor (mobile là WebView).
Chấp nhận: desktop web cần code riêng `.web.tsx` cho chuột/phím.

## ADR-002 · Tự xây lưới lịch, không dùng thư viện lịch
Cần ô có âm lịch, ngày lễ, (sau này) nhiều mốc giờ, trạng thái giữ lịch, time-block. Thư viện RN hiện có không đáp ứng;
FullCalendar Timeline là bản trả phí. Thuật toán layout là hàm thuần có test (`src/core/layout`).

## ADR-003 · Lịch âm tự viết theo thuật toán Hồ Ngọc Đức, UTC+7
Không dùng thư viện lịch Trung Quốc (lệch ngày: Tết 1985, 2007, 2030…). `lunar-javascript` chỉ là devDependency để đối chiếu trong test.
Đã phát hiện & sửa lỗi biên của thuật toán gốc (ra "ngày 0" ở 07/05/2054, 09/04/2062).

## ADR-004 · M1 lưu bằng IndexedDB (web) / SQLite key-value (native), mỗi record một key
Thay cho SQLite WASM trên web (còn thử nghiệm, cần header COOP/COEP). Dữ liệu nhỏ (vài nghìn record) nên nạp toàn bộ vào bộ nhớ là đủ nhanh.
Interface `RecordStorage` cho phép đổi sang SQLite/đồng bộ ở M3 mà không đổi UI.

## ADR-005 · ID UUIDv7 tạo ở client, soft delete, `updatedAt` trên mọi record
Chuẩn bị cho đồng bộ offline (M3) mà không cần migration dữ liệu cũ.

## ADR-006 · Ô nhập ngày giờ dạng gõ, không dùng picker của trình duyệt làm chính
Picker trình duyệt hiển thị theo locale hệ điều hành (AM/PM, mm/dd) — trái với cài đặt 24h & dd/mm.
Ô gõ hiểu "7h30", "2 chiều", "25/11"; vẫn có nút mở picker ngày của trình duyệt.

## ADR-007 · Kéo thả chỉ bằng chuột trên web ở M1
Cảm ứng trên web: chạm để tạo/mở (kéo = cuộn). Kéo cảm ứng native làm bằng gesture-handler ở M6.

## ADR-008 · Repo công khai, chưa có LICENSE
Bỏ file LICENSE của template Expo. Không có license = mọi quyền được bảo lưu (người khác xem được, không được dùng lại).
**Cần chủ sản phẩm chốt** nếu muốn mở nguồn (MIT…) hoặc giữ nguyên.

## ADR-009 · Không tích hợp Google Calendar (chủ sản phẩm quyết định 27/11/2026)

## ADR-010 · Mô hình lặp lại: master + exdates + override
Chỉ lưu bản gốc (quy tắc) + danh sách ngày bỏ (`exdates`) + bản ghi ngoại lệ (`recurrenceMasterId`, `recurrenceDay`).
Không lưu sẵn từng lần lặp. "Các sự kiện sau" = tách chuỗi (UNTIL/COUNT cho chuỗi cũ, chuỗi mới từ lần đó).
Quy tắc âm lịch là phần mở rộng riêng (`lunarMonthly`, `lunarYearly`) vì RRULE không biểu diễn được.

## ADR-011 · Tạo nhanh dựa trên luật, không AI
Parser chạy trên bản bỏ dấu ánh xạ 1:1 ký tự, nên tô/loại được đúng đoạn trong câu gốc. Chỗ đoán (3h → 15h, thứ trùng hôm nay,
ngày đã qua → năm sau) được báo để người dùng xác nhận. Có giờ → sự kiện; có lặp/ngày âm → sự kiện cả ngày; còn lại → công việc.

## ADR-012 · Các màn chính thay thế nhau (router.replace)
Tránh hai màn cùng mount (phím tắt và hộp thoại chạy hai lần). Cài đặt / Thùng rác vẫn mở chồng (push) để Back quay lại.

## ADR-013 · Công việc chỉnh sửa là lưu ngay
Mỗi thay đổi trong panel công việc được lưu tức thì (có Undo), giống Todoist/TickTick; sự kiện vẫn dùng nút Lưu.

## ADR-014 · Giao diện "đơn giản, sang, nhẹ" (27/11/2026) — theo yêu cầu chủ sản phẩm
Nền trắng ngà / xám ấm thay cho xám lạnh, chữ mực ấm, màu nhấn xanh chàm dịu. Ngày dương = chữ đậm màu chính;
ngày âm = vàng đồng (token `lunar`), mùng 1/rằm và ngày lễ = đỏ gạch (`holiday`). Bo góc lớn hơn (5/8/12).
Giờ làm việc mặc định 5h–23h (cài đặt cũ 8–18 chưa đổi sẽ tự chuyển).
