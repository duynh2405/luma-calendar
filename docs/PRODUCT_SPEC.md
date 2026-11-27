# Đặc tả sản phẩm

## Mục tiêu
Ứng dụng lịch + công việc mà chủ sản phẩm mở mỗi ngày, thay thế Google Calendar, cho nhiều mảng việc
(âm thanh – ánh sáng – sân khấu, quay chụp, hậu kỳ, phần mềm/AI, cá nhân, gia đình). Dùng cá nhân trước,
kiến trúc cho phép thương mại hóa sau.

## Quyết định phạm vi đã chốt (27/11/2026)
| # | Quyết định |
|---|---|
| 1 | Android trước; iOS sau (PWA miễn phí hoặc native 99 USD/năm — quyết định khi tới M6). |
| 2 | Làm cho cá nhân dùng trước. Backend (M3): Supabase Free, region Singapore, Postgres chuẩn để không bị khóa. |
| 3 | Stack: Expo (React Native) + TypeScript + Expo Router + React Native Web. |
| 4 | Thứ tự milestone mới (lặp lại & task → đồng bộ → Android + nhắc nhở → timeline …). |
| 5 | **Không** tích hợp Google Calendar (không nhập API, không đồng bộ 2 chiều). ICS nhập/xuất vẫn giữ, ưu tiên thấp. |
| 6 | Chia sẻ lịch / giao việc cho nhân sự: có thể cần trong ~6 tháng → mô hình dữ liệu lấy *Lịch* làm đơn vị chia sẻ. |
| 7 | "Trùng lịch" = trùng **ngày giờ**. Không làm quản lý tài nguyên thiết bị/nhân sự. |
| 8 | Repo GitHub **công khai**. Không có dữ liệu cá nhân trong repo. |
| 9 | Tên hiển thị "Luma Calendar" (cấu hình được), tên kỹ thuật `luma-calendar`. |

## Khái niệm chính
- **Lịch (Calendar)**: danh mục do người dùng tự tạo (Loa đài, Media, …). Dùng chung cho sự kiện và (M2) công việc.
- **Sự kiện (Event)**: có bắt đầu/kết thúc; có giờ hoặc cả ngày; có thể nhiều ngày.
- **Công việc (Task)** – M2: có/không có giờ, có deadline; time-block không làm mất deadline.

## Lịch âm
- Thuật toán thiên văn, múi giờ UTC+7 (đúng lịch Việt Nam từ 1968). Không dùng lịch Trung Quốc.
- Hiển thị ngày âm, mùng 1 (kèm tháng), rằm, tháng nhuận (hậu tố "N"), Can Chi ngày/tháng/năm, ngày lễ.
- Quy tắc lặp theo âm lịch (M2): ngày 30 của tháng thiếu → ngày 29; năm có tháng nhuận → mặc định chỉ tháng thường.
- Không đưa tử vi, giờ hoàng đạo, ngày tốt xấu.

## Ngoài phạm vi hiện tại
Google Calendar, quản lý tài nguyên thiết bị, ERP/kế toán, AI trả phí.
