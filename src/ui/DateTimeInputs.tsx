/** Native: typed inputs (native pickers come with the mobile milestone). */
import { type InputProps, TextDateInput, TextTimeInput } from './TextDateTime';

export function DateInput(p: InputProps) {
  return <TextDateInput {...p} />;
}

export function TimeInput(p: InputProps) {
  return <TextTimeInput {...p} />;
}
