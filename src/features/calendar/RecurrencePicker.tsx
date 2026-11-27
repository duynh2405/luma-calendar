/** Repeat rule picker (presets + custom) and a human description of a rule. */
import { ChevronDown, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { lunarOfDayKey } from '@/core/lunar/lunar';
import type { Locale } from '@/core/model/types';
import { nthWeekdayOf, type Recurrence } from '@/core/recurrence/recurrence';
import { addDays, type DayKey, parseDayKey, weekday } from '@/core/time/days';
import { formatDayKeyVi } from '@/core/time/parse';
import { type T, useLocale, useT } from '@/i18n';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '@/i18n/strings';
import { DateInput } from '@/ui/DateTimeInputs';
import { Field, HoverPressable, Segmented, Toggle, Txt } from '@/ui/primitives';
import { radius, useTheme } from '@/ui/theme';

function nthLabel(T: T, n: number) {
  return n === -1 ? T('nthLast') : T('nthN', { n });
}

export function describeRecurrence(T: T, locale: Locale, rule: Recurrence, start: DayKey): string {
  const { m, d } = parseDayKey(start);
  const l = lunarOfDayKey(start);
  const every = (unit: string) => (rule.interval > 1 ? `${T('every')} ${rule.interval} ${unit}` : '');
  let base: string;
  switch (rule.freq) {
    case 'daily':
      base = every(T('unitDay')) || T('repeatDaily');
      break;
    case 'weekly': {
      const days = (rule.byWeekday?.length ? rule.byWeekday : [weekday(start)]).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      const isWeekdays = days.length === 5 && [1, 2, 3, 4, 5].every((x) => days.includes(x));
      if (isWeekdays && rule.interval === 1) base = T('repeatWeekdays');
      else {
        const names = days.map((x) => WEEKDAY_LONG[locale][x]).join(', ');
        base = rule.interval > 1 ? `${every(T('unitWeek'))}: ${names}` : T('repeatWeekly', { wd: names });
      }
      break;
    }
    case 'monthly':
      base =
        rule.monthlyMode === 'nthWeekday'
          ? T('repeatMonthlyNth', { wd: WEEKDAY_LONG[locale][weekday(start)], nth: nthLabel(T, nthWeekdayOf(start)) })
          : T('repeatMonthly', { d });
      if (rule.interval > 1) base = `${every(T('unitMonth'))} · ${base}`;
      break;
    case 'yearly':
      base = T('repeatYearly', { d, m });
      if (rule.interval > 1) base = `${every(T('unitYear'))} · ${base}`;
      break;
    case 'lunarMonthly':
      base = T('repeatLunarMonthly', { d: l.day });
      break;
    case 'lunarYearly':
      base = T('repeatLunarYearly', { d: l.day, m: l.month });
      break;
  }
  if (rule.until) base += ` · ${T('endOn').toLowerCase()} ${formatDayKeyVi(rule.until)}`;
  else if (rule.count) base += ` · ${rule.count} ${T('occurrences')}`;
  return base;
}

function presets(start: DayKey): Recurrence[] {
  return [
    { freq: 'daily', interval: 1 },
    { freq: 'weekly', interval: 1, byWeekday: [weekday(start)] },
    { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] },
    { freq: 'monthly', interval: 1, monthlyMode: 'dayOfMonth' },
    { freq: 'monthly', interval: 1, monthlyMode: 'nthWeekday' },
    { freq: 'yearly', interval: 1 },
    { freq: 'lunarMonthly', interval: 1 },
    { freq: 'lunarYearly', interval: 1 },
  ];
}

const sameRule = (a: Recurrence | null | undefined, b: Recurrence | null | undefined) => {
  const norm = (r: Recurrence | null | undefined) =>
    r ? JSON.stringify({ ...r, byWeekday: r.byWeekday ? [...r.byWeekday].sort() : undefined, monthlyMode: r.monthlyMode ?? 'dayOfMonth', until: null, count: null }) : 'none';
  return norm(a) === norm(b);
};

export function RecurrencePicker({
  value,
  start,
  onChange,
}: {
  value: Recurrence | null;
  start: DayKey;
  onChange: (r: Recurrence | null) => void;
}) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const list = presets(start);
  const isPreset = !value || list.some((p) => sameRule(p, value));
  const showCustom = custom || (!!value && !isPreset);
  const summary = value ? describeRecurrence(T, locale, value, start) : T('repeatNone');

  const keepEnd = (r: Recurrence): Recurrence => ({ ...r, until: value?.until ?? null, count: value?.count ?? null });

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={T('repeat')}
        style={[styles.summary, { borderColor: t.borderStrong }]}
      >
        <Repeat size={16} color={t.textMuted} strokeWidth={1.75} />
        <Txt style={{ flex: 1 }} numberOfLines={1}>
          {summary}
        </Txt>
        <ChevronDown size={16} color={t.textMuted} strokeWidth={1.75} />
      </Pressable>
      {open ? (
        <View style={[styles.menu, { borderColor: t.border, backgroundColor: t.bg }]}>
          {[null, ...list].map((p, i) => {
            const selected = !showCustom && sameRule(p, value);
            return (
              <HoverPressable
                key={i}
                onPress={() => {
                  setCustom(false);
                  onChange(p ? keepEnd(p) : null);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ hovered }) => [styles.option, (hovered || selected) && { backgroundColor: t.surfaceAlt }]}
              >
                <Txt weight={selected ? 'semibold' : 'regular'}>{p ? describeRecurrence(T, locale, p, start) : T('repeatNone')}</Txt>
              </HoverPressable>
            );
          })}
          <HoverPressable
            onPress={() => {
              setCustom(true);
              if (!value) onChange({ freq: 'weekly', interval: 1, byWeekday: [weekday(start)] });
            }}
            style={({ hovered }) => [styles.option, (hovered || showCustom) && { backgroundColor: t.surfaceAlt }]}
          >
            <Txt weight={showCustom ? 'semibold' : 'regular'}>{T('repeatCustom')}</Txt>
          </HoverPressable>
        </View>
      ) : null}

      {value && (showCustom || open) ? <CustomRule value={value} start={start} onChange={onChange} custom={showCustom} /> : null}
    </View>
  );
}

function CustomRule({
  value,
  start,
  onChange,
  custom,
}: {
  value: Recurrence;
  start: DayKey;
  onChange: (r: Recurrence | null) => void;
  custom: boolean;
}) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const lunar = value.freq === 'lunarMonthly' || value.freq === 'lunarYearly';
  const endMode = value.until ? 'on' : value.count ? 'after' : 'never';
  const set = (patch: Partial<Recurrence>) => onChange({ ...value, ...patch });

  return (
    <View style={[styles.custom, { borderColor: t.border }]}>
      {custom && !lunar ? (
        <>
          <View style={styles.row}>
            <Txt size="sm" color="textMuted">
              {T('every')}
            </Txt>
            <View style={{ width: 64 }}>
              <Field
                value={String(value.interval)}
                keyboardType="number-pad"
                maxLength={3}
                onChangeText={(v) => {
                  const n = Number(v.replace(/\D/g, ''));
                  if (n >= 1) set({ interval: n });
                }}
              />
            </View>
            <Segmented
              size="sm"
              value={value.freq}
              onChange={(freq) =>
                onChange({
                  ...value,
                  freq,
                  byWeekday: freq === 'weekly' ? value.byWeekday ?? [weekday(start)] : undefined,
                })
              }
              options={[
                { value: 'daily', label: T('unitDay') },
                { value: 'weekly', label: T('unitWeek') },
                { value: 'monthly', label: T('unitMonth') },
                { value: 'yearly', label: T('unitYear') },
              ]}
            />
          </View>
          {value.freq === 'weekly' ? (
            <View style={styles.row}>
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const on = (value.byWeekday ?? [weekday(start)]).includes(wd);
                return (
                  <Pressable
                    key={wd}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      const cur = value.byWeekday ?? [weekday(start)];
                      const next = on ? cur.filter((x) => x !== wd) : [...cur, wd];
                      if (next.length) set({ byWeekday: next });
                    }}
                    style={[styles.dayChip, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accentSoft : t.bg }]}
                  >
                    <Txt size="sm" weight={on ? 'semibold' : 'regular'}>
                      {WEEKDAY_SHORT[locale][wd]}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
      {lunar ? (
        <>
          <Toggle
            label={T('includeLeap')}
            value={value.freq === 'lunarMonthly' ? value.leapMode !== 'regularOnly' : value.leapMode === 'both'}
            onChange={(v) => set({ leapMode: v ? 'both' : 'regularOnly' })}
          />
          <Txt size="xs" color="textMuted">
            {T('lunarRuleNote')}
          </Txt>
        </>
      ) : null}
      <View style={styles.row}>
        <Txt size="sm" color="textMuted">
          {T('repeatEnd')}
        </Txt>
        <Segmented
          size="sm"
          value={endMode}
          onChange={(mode) =>
            set(
              mode === 'never'
                ? { until: null, count: null }
                : mode === 'on'
                  ? { until: addDays(start, 30), count: null }
                  : { count: 10, until: null },
            )
          }
          options={[
            { value: 'never', label: T('endNever') },
            { value: 'on', label: T('endOn') },
            { value: 'after', label: T('endAfter') },
          ]}
        />
      </View>
      {endMode === 'on' ? <DateInput label={T('endOn')} value={value.until!} onChange={(until) => set({ until: until < start ? start : until })} /> : null}
      {endMode === 'after' ? (
        <View style={styles.row}>
          <View style={{ width: 72 }}>
            <Field
              value={String(value.count)}
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(v) => {
                const n = Number(v.replace(/\D/g, ''));
                if (n >= 1) set({ count: n });
              }}
            />
          </View>
          <Txt size="sm" color="textMuted">
            {T('occurrences')}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, height: 36, paddingHorizontal: 10 },
  menu: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  option: { paddingHorizontal: 12, paddingVertical: 8 },
  custom: { borderWidth: 1, borderRadius: radius.md, padding: 10, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dayChip: { minWidth: 36, height: 30, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
