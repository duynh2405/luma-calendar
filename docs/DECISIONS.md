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

## ADR-015 · Đồng bộ (M3): Supabase Free, ghi qua RPC, hợp nhất theo từng trường (27/11/2026) — duyệt bởi chủ sản phẩm
- Project `luma-calendar`, Supabase Free, Singapore (`ap-southeast-1`). Postgres thuần + RLS; chỉ phụ thuộc `auth.uid()`.
- Bảng `records(user_id, kind, id, data jsonb, rev, server_seq)` + `record_versions` (mọi lần ghi được giữ → khôi phục). Không có policy ghi trực tiếp; ghi qua `push_records()` (security definer, luôn lọc theo `auth.uid()`), kiểm tra `rev` (optimistic concurrency).
- Client lưu "bản cuối cùng hai bên đã thống nhất" (`base`) cho mỗi bản ghi. Xung đột → hợp nhất ba bên theo từng trường: trường nào chỉ một bên sửa thì lấy; cả hai sửa khác nhau thì bên có `updatedAt` mới hơn thắng. Xóa là xóa mềm nên đi chung đường này.
- Đăng nhập bằng mã một lần qua email (không lưu mật khẩu). Google OAuth cần chủ sản phẩm tạo OAuth client → làm sau.
- Giới hạn đã biết: `server_seq` cấp từ sequence nên hai giao dịch gần như đồng thời có thể commit lệch thứ tự (có thể bỏ sót một bản ghi ở lần pull sau với nhiều người dùng đồng thời; một người dùng thì không ảnh hưởng). Khi thương mại hóa cần đổi sang cơ chế cursor an toàn hơn.
- Settings (giao diện, ngôn ngữ…) chưa đồng bộ vì có phần riêng từng thiết bị.

## ADR-016 · Nhập task bằng giọng nói (27/11/2026) — yêu cầu của chủ sản phẩm
Web dùng SpeechRecognition của trình duyệt (vi-VN, miễn phí, không gửi qua máy chủ của mình). Công thức nói:
"Việc [tên], hạn [ngày giờ], ưu tiên [cao/vừa/thấp], danh mục [tên lịch], nhắc trước [1 ngày]" — `core/nlp/voice.ts` đổi từ khóa thành cú pháp parser đã có (`!3`, `#media`), phần ngày giờ do parser đọc. Kết quả chỉ **điền sẵn** để người dùng xem chip rồi Enter lưu. Android/iOS: M4 (expo-speech-recognition).

## ADR-017 · Thao tác kiểu "mỗi việc là một nút" (27/11/2026) — yêu cầu của chủ sản phẩm
Bỏ panel chi tiết cố định bên phải: chi tiết sự kiện/công việc chỉ mở dạng hộp pop-up khi bấm. Bấm bất kỳ đâu trong ô ngày tạo việc mới; rê vào ngày hiện +, rê vào việc hiện X (xóa có xác nhận; riêng chuỗi lặp dùng hộp chọn phạm vi). Lớp ngoài của mỗi việc không dùng `<button>` để tránh lồng nút trong nút. Màn "Hôm nay" thay bằng "Công việc sắp tới" (3/5 việc gần nhất từ ngày đang xem).

## ADR-018 · Đồng bộ nguồn ngoài một chiều (27/11/2026) — yêu cầu của chủ sản phẩm
Đảo quyết định "không tích hợp Google Calendar": cho phép kéo dữ liệu từ Google Calendar/Tasks và nền tảng khác vào Luma, **một chiều**. Thứ tự: ICS nhập file (xong) → link ICS đăng ký → Google OAuth (token ở Supabase Edge Function). Id sự kiện nhập từ ICS sinh từ UID nên nhập lại là cập nhật. RRULE ngoài tập hỗ trợ được nhập xấp xỉ và báo số lượng.

## ADR-019 · Cài đặt đồng bộ theo từng trường, sao lưu tự động, proxy ICS (27/11/2026)
- Chỉ đồng bộ các cài đặt dùng chung (SYNCED_SETTINGS); ngôn ngữ, giao diện, múi giờ là của từng máy. Bản ghi `settings/main`, hợp nhất 3 chiều như dữ liệu khác.
- Sao lưu tự động: 1 bản/ngày, giữ 7, lưu cạnh dữ liệu (khóa `backup:`); khôi phục = hợp nhất theo updatedAt.
- `ics-proxy` (verify_jwt bật): chỉ https, chặn host nội bộ/IP riêng, không theo chuyển hướng, tối đa 5 MB, 10 giây.

## ADR-020 · Nhắc việc bằng thông báo cục bộ (27/11/2026)
Lõi `planReminders` (thuần TS) tính danh sách thông báo; nền tảng chỉ việc đặt lịch (`expo-notifications` trên native, Notification API + timer trên web). Id thông báo ổn định theo (việc, lần lặp, mốc) nên đặt lại không bị trùng. Việc cả ngày/hạn không giờ tính 09:00. Web Push (nhắc khi đóng trình duyệt) cần máy chủ push, để sau. Build APK qua EAS (`eas.json`, profile preview) hoặc SDK cục bộ — cần chủ sản phẩm chọn.
