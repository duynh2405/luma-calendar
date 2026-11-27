# Luma Calendar

Ứng dụng lịch và quản lý công việc cá nhân, đa nền tảng (web, Android, iOS), có **lịch âm Việt Nam chính xác** (UTC+7).

> Trạng thái: **M2 – Lặp lại + Công việc + Hôm nay** (bản web, lưu dữ liệu trên trình duyệt). Xem [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Chạy thử (web)

Yêu cầu: Node.js 20+.

```bash
npm install
npm run web          # mở http://localhost:8081
```

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run web` | Chạy bản web (dev) |
| `npm test` | Chạy toàn bộ unit test (Vitest) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run lint` | ESLint |
| `npm run build:web` | Build web tĩnh vào `dist/` |

## Tài liệu

- [Đặc tả sản phẩm](docs/PRODUCT_SPEC.md)
- [Kiến trúc](docs/ARCHITECTURE.md)
- [Mô hình dữ liệu](docs/DATA_MODEL.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Lộ trình](docs/ROADMAP.md)
- [Quyết định kỹ thuật](docs/DECISIONS.md)
- [Kế hoạch kiểm thử](docs/TEST_PLAN.md)
- [Tình trạng dự án](docs/PROJECT_STATUS.md)
- [CHANGELOG](CHANGELOG.md)

## Dữ liệu & quyền riêng tư

Ở M1, dữ liệu chỉ nằm trong IndexedDB của trình duyệt bạn đang dùng. Không có server, không telemetry.
Hãy dùng **Cài đặt → Xuất dữ liệu (JSON)** để sao lưu cho tới khi có đồng bộ (M3).
