/**
 * Quick add bar: type a Vietnamese sentence, see what was understood as chips,
 * press Enter to save. Ambiguous guesses need a second Enter.
 */
import { AlertTriangle, Bell, CalendarDays, Clock, Flag, MapPin, Mic, Repeat, Square, Tag, Zap } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { parseQuickAdd } from '@/core/nlp/quickadd';
import { applyVoiceFormula } from '@/core/nlp/voice';
import type { CalendarEvent } from '@/core/model/types';
import { addDays } from '@/core/time/days';
import { formatMinutes, todayKey, wallToInstant } from '@/core/time/zone';
import { activeCalendars, defaultCalendarId, useData } from '@/data/store';
import { formatShortDate, useLocale, useT } from '@/i18n';
import type { StringKey } from '@/i18n/strings';
import { Segmented, Txt } from '@/ui/primitives';
import { font, radius, text, useTheme, withAlpha } from '@/ui/theme';

import { safely } from '../calendar/actions';
import { describeRecurrence } from '../calendar/RecurrencePicker';
import { useVoice } from './useVoice';

export function QuickAdd({ autoFocus, onCreated }: { autoFocus?: boolean; onCreated?: (kind: 'event' | 'task', id: string) => void }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const settings = useData((s) => s.settings);
  const calendars = useData((s) => s.calendars);
  const [input, setInput] = useState('');
  const [kindOverride, setKindOverride] = useState<'event' | 'task' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const cals = activeCalendars(calendars);
  const today = todayKey(settings.timeZone);

  const voice = useVoice();
  const { parsed, forceTask } = useMemo(() => {
    if (!input.trim()) return { parsed: null, forceTask: false };
    const calList = cals.map((c) => ({ id: c.id, name: c.name }));
    // The spoken formula ("Việc …, hạn …, ưu tiên …, danh mục …") is translated first; typed text passes through unchanged.
    const v = applyVoiceFormula(input, calList);
    return { parsed: parseQuickAdd(v.text, { today, defaultDurationMin: settings.defaultDurationMin, calendars: calList }), forceTask: v.forceTask };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, today, settings.defaultDurationMin, calendars]);
  const kind = kindOverride ?? (forceTask ? 'task' : parsed?.kind) ?? 'task';

  function reset() {
    setInput('');
    setKindOverride(null);
    setConfirming(false);
  }

  function submit() {
    if (!parsed) return;
    if (parsed.ambiguous.length && !confirming) {
      setConfirming(true);
      return;
    }
    const tz = settings.timeZone;
    const calendarId = parsed.calendarId ?? defaultCalendarId(calendars);
    if (kind === 'event') {
      if (!calendarId) return;
      const day = parsed.day ?? today;
      const fields: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> =
        parsed.startMin !== null
          ? {
              calendarId,
              title: parsed.title,
              description: '',
              location: parsed.location,
              color: null,
              allDay: false,
              start: wallToInstant(day, parsed.startMin, tz),
              end: wallToInstant(day, parsed.endMin ?? parsed.startMin + 60, tz),
              timeZone: tz,
              recurrence: parsed.recurrence,
              reminders: parsed.reminders,
            }
          : {
              calendarId,
              title: parsed.title,
              description: '',
              location: parsed.location,
              color: null,
              allDay: true,
              start: day,
              end: addDays(day, 1),
              timeZone: null,
              recurrence: parsed.recurrence,
              reminders: parsed.reminders,
            };
      // A range that ends before it starts (e.g. 22h–2h) ends the next day.
      if (!fields.allDay && fields.end <= fields.start) fields.end = wallToInstant(addDays(day, 1), parsed.endMin ?? 0, tz);
      const id = safely(() => useData.getState().createEvent(fields), 'event-created');
      if (id) {
        onCreated?.('event', id);
        reset();
      }
    } else {
      const id = safely(
        () =>
          useData.getState().createTask({
            // Tasks have no location field: keep "tại …" in the title.
            title: parsed.location ? `${parsed.title} tại ${parsed.location}` : parsed.title,
            calendarId: parsed.calendarId,
            dueDay: parsed.day,
            dueMin: parsed.day ? parsed.startMin : null,
            priority: parsed.priority,
            recurrence: parsed.day ? parsed.recurrence : null,
            reminders: parsed.reminders,
          }),
        'task-created',
      );
      if (id) {
        onCreated?.('task', id);
        reset();
      }
    }
  }

  const chips: { icon: ReactNode; label: string; warn?: boolean }[] = [];
  if (parsed) {
    const icon = (I: typeof Clock) => <I size={13} color={t.textMuted} strokeWidth={1.75} />;
    if (parsed.day) chips.push({ icon: icon(CalendarDays), label: formatShortDate(locale, parsed.day) });
    if (parsed.startMin !== null) {
      chips.push({
        icon: icon(Clock),
        label: `${formatMinutes(parsed.startMin, settings.timeFormat)}${parsed.endMin !== null && kind === 'event' ? ` – ${formatMinutes(parsed.endMin, settings.timeFormat)}` : ''}`,
      });
    }
    if (parsed.recurrence && parsed.day) chips.push({ icon: icon(Repeat), label: describeRecurrence(T, locale, parsed.recurrence, parsed.day) });
    for (const r of parsed.reminders) {
      chips.push({ icon: icon(Bell), label: r === 0 ? T('reminderAt') : T('reminderBefore', { v: humanMinutes(r, locale) }) });
    }
    if (parsed.location) chips.push({ icon: icon(MapPin), label: parsed.location });
    if (parsed.calendarId) chips.push({ icon: icon(Tag), label: calendars[parsed.calendarId]?.name ?? '' });
    if (parsed.priority) chips.push({ icon: icon(Flag), label: T(`p${parsed.priority}` as StringKey) });
    for (const a of parsed.ambiguous) chips.push({ icon: <AlertTriangle size={13} color={t.warning} strokeWidth={2} />, label: T(`amb.${a}` as StringKey), warn: true });
  }

  return (
    <View style={[styles.wrap, { borderColor: confirming ? t.warning : t.borderStrong, backgroundColor: t.bg }]}>
      <View style={styles.inputRow}>
        <Zap size={18} color={t.accent} strokeWidth={2} />
        <TextInput
          value={input}
          onChangeText={(v) => {
            setInput(v);
            setConfirming(false);
          }}
          onSubmitEditing={submit}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Escape') reset();
          }}
          blurOnSubmit={false}
          autoFocus={autoFocus}
          placeholder={T('quickAddPlaceholder')}
          placeholderTextColor={t.textFaint}
          accessibilityLabel={T('quickAddPlaceholder')}
          style={[styles.input, { color: t.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
        {voice.supported ? (
          <Pressable
            onPress={() => {
              if (voice.listening) voice.stop();
              else {
                reset();
                voice.start((text) => {
                  setInput(text);
                  setConfirming(false);
                });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={locale === 'vi' ? 'Nhập bằng giọng nói' : 'Voice input'}
            style={[styles.mic, { backgroundColor: voice.listening ? t.danger : t.accentSoft }]}
          >
            {voice.listening ? <Square size={12} color="#fff" fill="#fff" /> : <Mic size={16} color={t.accent} strokeWidth={2} />}
          </Pressable>
        ) : null}
      </View>
      {voice.listening || voice.error ? (
        <Txt size="xs" color={voice.error ? 'danger' : 'textMuted'}>
          {voice.error
            ? locale === 'vi'
              ? voice.error === 'not-allowed' ? 'Chưa cho phép micro cho trang này.' : voice.error === 'no-speech' ? 'Không nghe thấy gì, thử lại nhé.' : `Lỗi giọng nói: ${voice.error}`
              : `Voice error: ${voice.error}`
            : locale === 'vi'
              ? 'Đang nghe… nói theo mẫu: "Việc [tên], hạn [ngày giờ], ưu tiên [cao/vừa/thấp], danh mục [tên], nhắc trước [1 ngày]"'
              : 'Listening… "Task [name], due [date time], priority [high/medium/low], calendar [name], remind [1 day] before"'}
        </Txt>
      ) : null}
      {parsed ? (
        <View style={styles.preview}>
          <Segmented
            size="sm"
            value={kind}
            onChange={(k) => setKindOverride(k)}
            options={[
              { value: 'event', label: T('asEvent') },
              { value: 'task', label: T('asTask') },
            ]}
          />
          <Txt size="sm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {parsed.title}
          </Txt>
          {chips.map((c, i) => (
            <View
              key={i}
              style={[
                styles.chip,
                { backgroundColor: c.warn ? t.warningSoft : withAlpha(t.textFaint, 0.12) },
              ]}
            >
              {c.icon}
              <Txt size="xs" color={c.warn ? 'warning' : 'text'} numberOfLines={1}>
                {c.label}
              </Txt>
            </View>
          ))}
          <Pressable onPress={submit} accessibilityRole="button" style={{ marginLeft: 'auto' }}>
            <Txt size="xs" color={confirming ? 'warning' : 'textMuted'}>
              {confirming ? T('quickAddConfirm') : T('quickAddHint')}
            </Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function humanMinutes(m: number, locale: 'vi' | 'en'): string {
  const vi = locale === 'vi';
  if (m % 10080 === 0) return `${m / 10080} ${vi ? 'tuần' : 'week(s)'}`;
  if (m % 1440 === 0) return `${m / 1440} ${vi ? 'ngày' : 'day(s)'}`;
  if (m % 60 === 0) return `${m / 60} ${vi ? 'giờ' : 'hour(s)'}`;
  return `${m} ${vi ? 'phút' : 'min'}`;
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: font.regular, fontSize: text.lg, minHeight: 32 },
  preview: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  mic: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sm, paddingHorizontal: 6, height: 22 },
});
