# CLAUDE.md — hướng dẫn cho AI coding agent

Đọc thêm `AGENTS.md` (quy tắc Expo chung) và `docs/PROJECT_STATUS.md` (đang ở đâu) trước khi làm.

## Nguyên tắc
- Chủ sản phẩm duyệt từng milestone. **Không tự chuyển milestone.** Quyết định lớn (kiến trúc, chi phí, bảo mật, dữ liệu, phạm vi) phải hỏi.
- Không tuyên bố hoàn thành nếu chưa test. Báo cáo cuối milestone theo mẫu trong `docs/PROJECT_STATUS.md`.
- Không commit secrets, không đưa dữ liệu thật/dữ liệu giả vào môi trường dùng thật. Repo này **công khai**.
- Không thêm dịch vụ trả phí. Không telemetry.
- UI tiếng Việt mặc định; mọi chuỗi qua `src/i18n/strings.ts` (vi + en).

## Cấu trúc
```
src/core/      TypeScript thuần, KHÔNG import react-native. Lịch âm, thời gian, layout, model. Có test.
src/data/      Store (zustand) + lưu trữ (IndexedDB web / SQLite kv native). Mọi mutation qua store.
src/features/  Màn hình & component theo tính năng.
src/ui/        Design system (theme, primitives, icons, input ngày giờ).
src/i18n/      Chuỗi & định dạng ngày.
src/app/       Route của Expo Router (mỏng, chỉ gọi screen).
```

## Quy tắc code
- Thời gian: sự kiện có giờ lưu UTC ISO + `timeZone`; cả ngày lưu ngày "trôi" `YYYY-MM-DD`, `end` **exclusive**.
  Mọi phép tính ngày dùng `src/core/time/days.ts` (UTC-only) và `zone.ts` (Intl). Không dùng `new Date().getHours()`.
- ID: `uuidv7()`. Xóa: luôn soft delete (`deletedAt`). Mutation đi qua `useData` để có Undo + lưu ngay.
- React Compiler đang bật: tuân thủ lint `react-hooks/*` (không setState trong effect, không đọc ref khi render).
  Reset form bằng `key`, điều chỉnh state theo props bằng mẫu "adjust during render".
- Tương tác chuột desktop dùng `usePointerDrag` (web). Native gesture làm ở M6.
- Logic mới ở `src/core` phải có test Vitest.

## Kiểm tra trước khi báo xong
```bash
npm test && npm run typecheck && npm run lint
```
và mở bản web để tự thử thao tác đã đổi.
