/**
 * Typed date/time inputs shared by all platforms. They show dd/mm/yyyy and the
 * user's 12h/24h preference (browser pickers follow the OS locale instead),
 * and accept quick input like "7h30", "19.30", "25/11".
 * Values are exchanged as "YYYY-MM-DD" and "HH:MM".
 */
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { formatDayKeyVi, parseDateText, parseTimeText } from '@/core/time/parse';
import { formatMinutes } from '@/core/time/zone';
import { useData } from '@/data/store';

import { Field } from './primitives';

export interface InputProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
}

function useCommitField(display: string, parse: (s: string) => string | null, onChange: (v: string) => void) {
  const [text, setText] = useState(display);
  const [last, setLast] = useState(display);
  const [invalid, setInvalid] = useState(false);
  if (display !== last) {
    setLast(display);
    setText(display);
    setInvalid(false);
  }
  const commit = () => {
    const v = parse(text);
    if (v === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(v);
    setText(display);
  };
  return { text, setText, invalid, commit };
}

export function TextTimeInput({ value, onChange, label }: InputProps) {
  const fmt = useData((s) => s.settings.timeFormat);
  const minutes = Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const display = formatMinutes(minutes, fmt);
  const f = useCommitField(
    display,
    (s) => {
      const m = parseTimeText(s);
      return m === null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    },
    onChange,
  );
  return (
    <Field
      accessibilityLabel={label}
      value={f.text}
      onChangeText={f.setText}
      onBlur={f.commit}
      onSubmitEditing={f.commit}
      selectTextOnFocus
      error={f.invalid ? ' ' : null}
      style={{ width: fmt === '12h' ? 96 : 72, textAlign: 'center' }}
    />
  );
}

export function TextDateInput({ value, onChange, label, trailing }: InputProps & { trailing?: ReactNode }) {
  const f = useCommitField(formatDayKeyVi(value), (s) => parseDateText(s, value), onChange);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
      <Field
        accessibilityLabel={label}
        value={f.text}
        onChangeText={f.setText}
        onBlur={f.commit}
        onSubmitEditing={f.commit}
        selectTextOnFocus
        error={f.invalid ? ' ' : null}
        style={{ width: 112, textAlign: 'center' }}
      />
      {trailing}
    </View>
  );
}
