# Mô hình dữ liệu (schema 2)

Mọi record: `id` (UUIDv7, tạo ở client), `createdAt`, `updatedAt`, `deletedAt` (soft delete).

## Calendar
| Trường | Kiểu | Ghi chú |
|---|---|---|
| name | string ≤ 60 | |
| color | `#RRGGBB` | |
| icon | string | khóa trong `src/ui/icons.tsx` — **không đổi tên khóa** |
| sortOrder | number | |
| visible | boolean | |
| isDefault | boolean | đúng 1 lịch mặc định |
| archivedAt | ISO \| null | lưu trữ: ẩn khỏi lịch, dữ liệu còn nguyên |

## Event
| Trường | Kiểu | Ghi chú |
|---|---|---|
| calendarId | id | |
| title | string 1–200 | |
| description | string ≤ 10 000 | |
| location | string ≤ 300 | |
| color | `#RRGGBB` \| null | null = màu của lịch |
| allDay | boolean | |
| start, end | timed: UTC ISO · all-day: `YYYY-MM-DD` | all-day `end` exclusive; `end > start` |
| timeZone | IANA \| null | null với sự kiện cả ngày |

## Event – trường thêm ở schema 2 (tùy chọn)
| Trường | Ghi chú |
|---|---|
| recurrence | `{ freq, interval, byWeekday?, monthlyMode?, leapMode?, until?, count? }`; freq ∈ daily, weekly, monthly, yearly, lunarMonthly, lunarYearly |
| exdates | ngày lặp bị xóa |
| recurrenceMasterId, recurrenceDay | bản ghi ngoại lệ thay cho lần lặp ngày `recurrenceDay` |
| taskId | khối thời gian của công việc |
| reminders | phút trước giờ bắt đầu (gửi từ M4) |

## Task
| Trường | Ghi chú |
|---|---|
| title, notes | |
| calendarId | danh mục (null + không ngày + không cha = Inbox) |
| parentId | việc con |
| status | todo, doing, waiting, done, cancelled |
| priority | 0–3 |
| startDay, dueDay, dueMin | ngày bắt đầu, hạn chót, giờ hạn (phút) |
| estimateMin, progress | progress null = tự tính từ việc con + danh sách kiểm |
| checklist | `[{ id, text, done }]` |
| tags, links | |
| recurrence, completions | hoàn thành việc lặp → dueDay sang lần kế, ghi vào completions |
| linkedEventId, linkRole | việc chuẩn bị (prep) / hậu kỳ (post) của sự kiện |
| reminders | |

## Settings
`locale, theme, timeZone, weekStart (0|1|6), timeFormat, workStart, workEnd (phút), showWeekends,
showLunar, showHolidays, defaultView, defaultDurationMin`. Mặc định: vi, Asia/Ho_Chi_Minh, thứ Hai, 24h.

## Lưu trữ cục bộ
Key: `meta`, `settings`, `cal:<id>`, `evt:<id>`, `task:<id>`. Tăng `SCHEMA_VERSION` + viết migration khi đổi cấu trúc.

## File sao lưu JSON
```json
{ "app": "luma-calendar", "schema": 2, "exportedAt": "...", "settings": {}, "calendars": [], "events": [], "tasks": [] }
```
Nhập: gộp theo `id`, chỉ ghi đè khi bản nhập có `updatedAt` mới hơn → nhập lại nhiều lần không tạo trùng.

## Dự kiến (M2–M3)
tasks, checklist_items, task_completions, event_task_links, projects, tags/taggings, reminders,
devices, notification_log, saved_views, templates, custom_field_defs, revisions, calendar_members.
Recurrence: `rrule` (RFC 5545) + `exdate` + bản ghi ngoại lệ (`recurrenceMasterId`, `recurrenceId`);
âm lịch: `lunarRule` riêng. Không lưu sẵn từng lần lặp.
