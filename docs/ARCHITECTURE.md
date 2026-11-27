# Kiến trúc

## Tổng quan
```
┌──────────── Expo app (một codebase TypeScript) ─────────────┐
│ src/app (routes) → src/features (screens) → src/ui          │
│                         │                                     │
│                   src/data/store (zustand, Undo, outbox*)     │
│                         │                                     │
│      storage.web.ts (IndexedDB)  |  storage.ts (SQLite kv)    │
│                                                               │
│ src/core: lịch âm · thời gian · layout · model · backup       │
│           (TS thuần, không phụ thuộc nền tảng, có test)       │
└───────────────────────────────────────────────────────────────┘
            * M3: outbox → sync_push / sync_pull (Postgres/Supabase)
```

## Lựa chọn công nghệ (đã kiểm tra phiên bản 27/11/2026)
| Phần | Chọn | Phiên bản | Giấy phép |
|---|---|---|---|
| App | Expo SDK | 58.1 | MIT |
| UI runtime | React Native / RN Web | 0.88 / 0.21 | MIT |
| Routing | expo-router | 58 | MIT |
| State | zustand | 5 | MIT |
| Lưu web | idb-keyval (IndexedDB) | 6 | Apache-2.0 |
| Lưu native | expo-sqlite/kv-store | 58 | MIT |
| Icon | lucide-react-native | 1.x | ISC |
| Font | Be Vietnam Pro | — | OFL |
| Test | Vitest (+ lunar-javascript chỉ để đối chiếu) | 5 / 1.7 | MIT |

## Luồng dữ liệu
1. UI gọi action của `useData` (store).
2. Store validate (`core/model/validate.ts`), cập nhật state, ghi **ngay** từng record vào storage (một key/record),
   đẩy bản trước-khi-sửa vào ngăn Undo.
3. Mọi view đọc qua selector (`visibleEvents`) và tính layout bằng hàm thuần ở `core/layout`.

## Thời gian
- Sự kiện có giờ: `start`/`end` là UTC ISO + `timeZone` lúc tạo. Hiển thị theo múi giờ trong Cài đặt.
- Sự kiện cả ngày: ngày "trôi" (`YYYY-MM-DD`), `end` exclusive (chuẩn RFC 5545).
- Sự kiện ≥ 24 giờ hiển thị ở dải "Cả ngày" (giống Google Calendar).

## Tương tác
- Web desktop: pointer events + listener trên `window` (`usePointerDrag`), bắt phím ở capture phase.
- Cảm ứng trên web: chạm để tạo/mở; không kéo (để cuộn). Kéo trên native: react-native-gesture-handler ở M6.

## Kế hoạch đồng bộ (M3) — tóm tắt
Outbox trong cùng thao tác ghi; mutation idempotent; pull theo `server_seq`; LWW theo từng trường bằng HLC;
soft delete; lịch sử phiên bản; Realtime chỉ để "gõ cửa". Server là hàm Postgres chạy dưới RLS.
