/** Lunar ↔ solar date converter. */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { canChiYear } from '@/core/lunar/canchi';
import { dayInfo } from '@/core/lunar/dayinfo';
import { leapMonthOfYear, lunarToSolar } from '@/core/lunar/lunar';
import { dayKey } from '@/core/time/days';
import { todayKey } from '@/core/time/zone';
import { useData } from '@/data/store';
import { canChiLine, formatLongDate, lunarFullLabel, useLocale, useT } from '@/i18n';
import { DateInput } from '@/ui/DateTimeInputs';
import { Button, Dialog, Field, Segmented, Toggle, Txt } from '@/ui/primitives';

import { useUi } from './ui-store';

export function ConverterDialog() {
  const T = useT();
  const locale = useLocale();
  const open = useUi((s) => s.converterOpen);
  const tz = useData((s) => s.settings.timeZone);
  const [mode, setMode] = useState<'s2l' | 'l2s'>('s2l');
  const [solar, setSolar] = useState(() => todayKey(tz));
  const today = dayInfo(todayKey(tz)).lunar;
  const [ld, setLd] = useState(String(today.day));
  const [lm, setLm] = useState(String(today.month));
  const [ly, setLy] = useState(String(today.year));
  const [leap, setLeap] = useState(false);

  const close = () => useUi.getState().setConverter(false);

  const l2s = useMemo(() => {
    const d = Number(ld);
    const m = Number(lm);
    const y = Number(ly);
    if (!d || !m || !y || m > 12 || y < 1900 || y > 2199) return null;
    const r = lunarToSolar(d, m, y, leap);
    return r ? dayKey(r.year, r.month, r.day) : null;
  }, [ld, lm, ly, leap]);

  if (!open) return null;

  const result = mode === 's2l' ? solar : l2s;
  const info = result ? dayInfo(result) : null;
  const leapOfYear = leapMonthOfYear(Number(ly) || 0);

  return (
    <Dialog
      visible
      onClose={close}
      title={T('converter')}
      footer={
        <>
          <Button label={T('close')} onPress={close} />
          <Button
            label={T('go')}
            variant="primary"
            disabled={!result}
            onPress={() => {
              if (!result) return;
              useUi.getState().setCursor(result);
              useUi.getState().setView('day');
              close();
            }}
          />
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 's2l', label: T('solarToLunar') },
          { value: 'l2s', label: T('lunarToSolar') },
        ]}
      />
      {mode === 's2l' ? (
        <DateInput label={T('day')} value={solar} onChange={setSolar} />
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 70 }}>
              <Field label={T('day')} value={ld} onChangeText={setLd} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ width: 70 }}>
              <Field label={T('month')} value={lm} onChangeText={setLm} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ width: 90 }}>
              <Field label={T('year')} value={ly} onChangeText={setLy} keyboardType="number-pad" maxLength={4} />
            </View>
          </View>
          <Toggle label={T('leapMonth')} value={leap} onChange={setLeap} />
          <Txt size="sm" color="textMuted">
            {canChiYear(Number(ly) || 0)}
            {leapOfYear ? ` · ${T('leapMonth')} ${leapOfYear}` : ''}
          </Txt>
        </View>
      )}
      <View style={{ gap: 4, paddingTop: 4 }}>
        {result && info ? (
          <>
            <Txt size="lg" weight="semibold">
              {formatLongDate(locale, result)}
            </Txt>
            <Txt>
              {T('lunarPrefix')}: {lunarFullLabel(T, info.lunar)}
            </Txt>
            <Txt size="sm" color="textMuted">
              {canChiLine(T, result, info.lunar)}
            </Txt>
            {info.holidays.length ? (
              <Txt size="sm" color="holiday">
                {info.holidays.map((h) => h.name[locale]).join(' · ')}
              </Txt>
            ) : null}
          </>
        ) : (
          <Txt color="danger">{T('invalidLunarDate')}</Txt>
        )}
      </View>
    </Dialog>
  );
}
