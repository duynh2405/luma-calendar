import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLocale } from '@/i18n';
import { Txt } from '@/ui/primitives';
import { radius, useTheme, withAlpha } from '@/ui/theme';

const PRESETS = [0, 10, 30, 60, 1440];

export function reminderLabel(min: number, vi: boolean): string {
  if (min === 0) return vi ? 'Đúng giờ' : 'At start';
  if (min % 1440 === 0) return vi ? `${min / 1440} ngày trước` : `${min / 1440} d before`;
  if (min % 60 === 0) return vi ? `${min / 60} giờ trước` : `${min / 60} h before`;
  return vi ? `${min} phút trước` : `${min} min before`;
}

/** Toggle chips for reminder offsets (minutes before start / due). Values outside the presets are kept. */
export function ReminderPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const t = useTheme();
  const vi = useLocale() === 'vi';
  const all = [...new Set([...PRESETS, ...value])].sort((a, b) => a - b);
  const toggle = (m: number) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b));
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.head}>
        <Bell size={16} color={t.textMuted} strokeWidth={1.75} />
        <Txt size="sm" color="textMuted">
          {vi ? 'Nhắc việc' : 'Reminders'}
        </Txt>
      </View>
      <View style={styles.chips}>
        {all.map((m) => {
          const on = value.includes(m);
          return (
            <Pressable
              key={m}
              onPress={() => toggle(m)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.chip, { borderColor: on ? t.accent : t.border, backgroundColor: on ? withAlpha(t.accent, 0.14) : 'transparent' }]}
            >
              <Txt size="sm" color={on ? 'accent' : 'textMuted'} weight={on ? 'semibold' : 'regular'}>
                {reminderLabel(m, vi)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, height: 28, justifyContent: 'center' },
});
