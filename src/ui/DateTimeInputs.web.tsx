/**
 * Web: typed inputs, plus a button that opens the browser's date picker
 * (hidden <input type=date> + showPicker()) for picking with the mouse.
 */
import { CalendarDays } from 'lucide-react-native';
import { createElement, useRef } from 'react';

import { useT } from '@/i18n';

import { IconButton } from './primitives';
import { type InputProps, TextDateInput, TextTimeInput } from './TextDateTime';

function PickerButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const T = useT();
  const ref = useRef<HTMLInputElement | null>(null);
  const open = () => {
    const el = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    try {
      el?.showPicker?.();
    } catch {
      el?.focus();
    }
  };
  return (
    <>
      {createElement('input', {
        ref,
        type: 'date',
        value,
        tabIndex: -1,
        'aria-hidden': true,
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
        style: { position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' },
      })}
      <IconButton icon={CalendarDays} title={T('pickDate')} onPress={open} />
    </>
  );
}

export function DateInput(p: InputProps) {
  return <TextDateInput {...p} trailing={<PickerButton value={p.value} onChange={p.onChange} />} />;
}

export function TimeInput(p: InputProps) {
  return <TextTimeInput {...p} />;
}
