import {
  Book,
  Briefcase,
  CalendarDays,
  Camera,
  Clapperboard,
  Cpu,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  type LucideIcon,
  Mic,
  Music,
  Plane,
  Speaker,
  Star,
  User,
  Users,
} from 'lucide-react-native';

/** Icons a user can pick for a calendar. Keys are stored in data — never rename a key. */
export const CALENDAR_ICONS: Record<string, LucideIcon> = {
  calendar: CalendarDays,
  speaker: Speaker,
  mic: Mic,
  music: Music,
  camera: Camera,
  film: Clapperboard,
  briefcase: Briefcase,
  cpu: Cpu,
  lightbulb: Lightbulb,
  user: User,
  users: Users,
  home: Home,
  heart: Heart,
  star: Star,
  book: Book,
  school: GraduationCap,
  plane: Plane,
};

export function calendarIcon(key: string): LucideIcon {
  return CALENDAR_ICONS[key] ?? CalendarDays;
}

/** Renders a calendar's icon by key (a component, so it isn't re-created during render). */
export function CalendarIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = CALENDAR_ICONS[name] ?? CalendarDays;
  return <Icon size={size} color={color} strokeWidth={1.75} />;
}
