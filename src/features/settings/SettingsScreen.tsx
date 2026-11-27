import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Settings } from '@/core/model/types';
import { deviceTimeZone } from '@/core/time/zone';
import { pickTextFile, saveTextFile } from '@/data/file-io';
import { useData } from '@/data/store';
import { useT } from '@/i18n';
import { TimeInput } from '@/ui/DateTimeInputs';
import { Button, Divider, Field, IconButton, Segmented, Toggle, Txt } from '@/ui/primitives';
import { space, useTheme } from '@/ui/theme';

import { safely } from '../calendar/actions';
import { Toast } from '../calendar/Toast';
import { useUi } from '../calendar/ui-store';

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function SettingsScreen() {
  const t = useTheme();
  const T = useT();
  const insets = useSafeAreaInsets();
  const s = useData((st) => st.settings);
  const set = (patch: Partial<Settings>) => useData.getState().updateSettings(patch);
  const [tzText, setTzText] = useState(s.timeZone);
  const [tzError, setTzError] = useState<string | null>(null);

  async function doExport() {
    const backup = useData.getState().exportBackup();
    const stamp = backup.exportedAt.slice(0, 10);
    try {
      await saveTextFile(`luma-calendar-${stamp}.json`, JSON.stringify(backup, null, 2));
    } catch (e) {
      useUi.getState().showToast(String(e));
    }
  }

  async function doImport() {
    let text: string | null = null;
    try {
      text = await pickTextFile();
    } catch (e) {
      useUi.getState().showToast(String(e));
      return;
    }
    if (!text) return;
    const stats = safely(() => useData.getState().importBackup(text));
    if (stats) useUi.getState().showToast(T('importDone', stats), stats.added + stats.updated > 0);
    else useUi.getState().showToast(T('importFailed'));
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <IconButton icon={ArrowLeft} title={T('back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Txt size="xl" weight="semibold">
          {T('settings')}
        </Txt>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={T('general')}>
          <Row label={T('language')}>
            <Segmented
              value={s.locale}
              onChange={(locale) => set({ locale })}
              options={[
                { value: 'vi', label: 'Tiếng Việt' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Row>
          <Row label={T('theme')}>
            <Segmented
              value={s.theme}
              onChange={(theme) => set({ theme })}
              options={[
                { value: 'system', label: T('themeSystem') },
                { value: 'light', label: T('themeLight') },
                { value: 'dark', label: T('themeDark') },
              ]}
            />
          </Row>
          <Row label={T('timeZone')}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <View style={{ width: 220 }}>
                <Field
                  value={tzText}
                  onChangeText={(v) => {
                    setTzText(v);
                    setTzError(null);
                  }}
                  onBlur={() => {
                    if (isValidTimeZone(tzText)) set({ timeZone: tzText });
                    else setTzError(T('err.invalid-date'));
                  }}
                  error={tzError}
                  autoCapitalize="none"
                />
              </View>
              <Button
                size="sm"
                label={deviceTimeZone()}
                onPress={() => {
                  setTzText(deviceTimeZone());
                  set({ timeZone: deviceTimeZone() });
                }}
              />
            </View>
          </Row>
        </Section>

        <Section title={T('calendar')}>
          <Row label={T('weekStart')}>
            <Segmented
              value={s.weekStart}
              onChange={(weekStart) => set({ weekStart })}
              options={[
                { value: 1, label: s.locale === 'vi' ? 'Thứ Hai' : 'Monday' },
                { value: 0, label: s.locale === 'vi' ? 'Chủ Nhật' : 'Sunday' },
                { value: 6, label: s.locale === 'vi' ? 'Thứ Bảy' : 'Saturday' },
              ]}
            />
          </Row>
          <Row label={T('timeFormat')}>
            <Segmented
              value={s.timeFormat}
              onChange={(timeFormat) => set({ timeFormat })}
              options={[
                { value: '24h', label: '24h' },
                { value: '12h', label: '12h' },
              ]}
            />
          </Row>
          <Row label={T('workHours')}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TimeInput label={T('start')} value={toHHMM(s.workStart)} onChange={(v) => fromHHMM(v) < s.workEnd && set({ workStart: fromHHMM(v) })} />
              <Txt color="textMuted">–</Txt>
              <TimeInput label={T('end')} value={toHHMM(s.workEnd)} onChange={(v) => fromHHMM(v) > s.workStart && set({ workEnd: fromHHMM(v) })} />
            </View>
          </Row>
          <Row label={T('defaultView')}>
            <Segmented
              value={s.defaultView}
              onChange={(defaultView) => set({ defaultView })}
              options={[
                { value: 'day', label: T('viewDay') },
                { value: '3day', label: T('view3day') },
                { value: 'week', label: T('viewWeek') },
                { value: 'month', label: T('viewMonth') },
                { value: 'agenda', label: T('viewAgenda') },
              ]}
            />
          </Row>
          <Row label={T('defaultDuration')}>
            <Segmented
              value={s.defaultDurationMin}
              onChange={(defaultDurationMin) => set({ defaultDurationMin })}
              options={[30, 60, 90, 120].map((m) => ({ value: m, label: `${m} ${T('minutes')}` }))}
            />
          </Row>
          <Toggle label={T('showWeekends')} value={s.showWeekends} onChange={(showWeekends) => set({ showWeekends })} />
          <Toggle label={T('showLunar')} value={s.showLunar} onChange={(showLunar) => set({ showLunar })} />
          <Toggle label={T('showHolidays')} value={s.showHolidays} onChange={(showHolidays) => set({ showHolidays })} />
        </Section>

        <Section title={T('data')}>
          <Txt size="sm" color="textMuted">
            {T('dataNote')}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label={T('exportJson')} onPress={doExport} />
            <Button label={T('importJson')} onPress={doImport} />
          </View>
        </Section>

        <Section title={T('shortcuts')}>
          {[
            ['C', s.locale === 'vi' ? 'Tạo sự kiện' : 'Create event'],
            ['T', T('today')],
            ['D / X / W / M / A', `${T('viewDay')} / ${T('view3day')} / ${T('viewWeek')} / ${T('viewMonth')} / ${T('viewAgenda')}`],
            ['J / K  ·  ← →', `${T('next')} / ${T('prev')}`],
            ['Ctrl + Z', T('undo')],
            ['Delete', s.locale === 'vi' ? 'Xóa sự kiện đang mở' : 'Delete open event'],
            ['Esc', T('close')],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', gap: 12 }}>
              <Txt size="sm" weight="semibold" style={{ width: 140 }}>
                {k}
              </Txt>
              <Txt size="sm" color="textMuted">
                {v}
              </Txt>
            </View>
          ))}
        </Section>
      </ScrollView>
      <Toast />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <Txt size="sm" weight="semibold" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </Txt>
      {children}
      <Divider />
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Txt style={{ width: 180 }}>{label}</Txt>
      <View style={{ flex: 1, minWidth: 240, alignItems: 'flex-start' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, paddingHorizontal: space.md, borderBottomWidth: 1 },
  content: { padding: space.xl, gap: space.xl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
