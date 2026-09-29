import { useRef, useState } from 'react';
import type { GestureResponderEvent, NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';

type Range = { start: number; end: number };

/**
 * A second tap in a filled field selects the whole value on some phones,
 * especially emails with no spaces. Put the caret back near that tap
 * so the next key changes one letter.
 */
export function useEditableCaret(value: string, ltr = false) {
  const caret = useRef(value.length);
  const pressX = useRef<number | null>(null);
  const pressedAt = useRef(0);
  const fixing = useRef(false);
  const [selection, setSelection] = useState<Range | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSelection(undefined), 60);
  };

  const place = (index: number) => {
    const pos = Math.max(0, Math.min(index, value.length));
    caret.current = pos;
    fixing.current = true;
    setSelection({ start: pos, end: pos });
    release();
    setTimeout(() => {
      fixing.current = false;
    }, 80);
  };

  const indexFromPress = () => {
    const x = pressX.current;
    if (x == null || value.length === 0) return caret.current;
    const pad = 16;
    const charWidth = 9;
    const raw = Math.round((x - pad) / charWidth);
    const clamped = Math.max(0, Math.min(value.length, raw));
    return ltr ? clamped : value.length - clamped;
  };

  const onPressIn = (event: GestureResponderEvent) => {
    pressX.current = event.nativeEvent.locationX;
    pressedAt.current = Date.now();
  };

  const onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const { start, end } = event.nativeEvent.selection;
    if (fixing.current) return;
    const entire = value.length > 1 && start === 0 && end === value.length;
    const recent = Date.now() - pressedAt.current < 700;
    if (entire && recent) {
      place(indexFromPress());
      return;
    }
    if (start === end) caret.current = start;
  };

  return {
    selection,
    onPressIn,
    onSelectionChange,
    selectTextOnFocus: false as const,
  };
}
