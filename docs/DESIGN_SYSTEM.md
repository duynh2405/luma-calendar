# Design system

Nguồn: `src/ui/theme.ts`, `src/ui/primitives.tsx`.

## Nguyên tắc
Tối giản, mật độ thông tin vừa phải, một màu nhấn, đường kẻ mảnh thay cho đổ bóng, bo góc nhỏ (4–8px),
không gradient, không emoji làm icon. Icon: Lucide, nét 1.75.

## Màu (light / dark)
| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| bg | #FFFFFF | #101114 | nền |
| surfaceAlt | #EFEFF2 | #1F2025 | hover, segmented |
| border | #E6E6EA | #2A2B31 | đường kẻ |
| text / textMuted / textFaint | #16171B / #62646E / #9A9CA6 | #ECECEF / #A0A2AB / #6C6E78 | chữ |
| accent | #3B5BDB | #7C93FF | nút chính, hôm nay |
| nowLine | #E5484D | #FF6369 | vạch giờ hiện tại |
| holiday | #C2410C | #FB923C | ngày lễ, mùng 1, rằm |
| danger / warning | #D92D20 / #B54708 | #FF6B5E / #F5A524 | xóa / trùng giờ |

16 màu lịch: `CALENDAR_COLORS` trong `src/data/store.ts`. Sự kiện: nền tô màu lịch ở độ trong 16% (dark 26%) + vạch trái 3px.

## Typography
Be Vietnam Pro 400/500/600/700. Cỡ: 11, 12, 14 (mặc định), 16, 20, 24. Số giờ dùng `tabular-nums`.

## Khoảng cách
4 · 8 · 12 · 16 · 24 · 32. Breakpoint: tablet 768, desktop 1100.

## Thành phần
Txt, Button (primary/secondary/ghost/danger, sm/md), IconButton, Field, Toggle, Segmented, Dialog,
HoverPressable, DateInput/TimeInput, EventBar, Toast.
Trạng thái: hover (web), pressed, selected (viền), disabled (opacity 0.45), ghost khi kéo.
