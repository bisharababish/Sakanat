import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { NAME_WORD_MAX, cleanName, nameWords } from '@/src/lib/name';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

const PARTS = ['nameFirst', 'nameSecond', 'nameThird', 'nameLast'] as const;
const ARABIC_CHAR =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_CHAR = /[A-Za-z]/;

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  script: 'en' | 'ar';
  soft?: boolean;
  compact?: boolean;
};

function sanitizePart(raw: string, script: 'en' | 'ar') {
  if (script === 'en') return raw.replace(/[^A-Za-z'\-]/g, '');
  return raw.replace(
    /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF'\-]/g,
    '',
  );
}

function partsFromValue(value: string) {
  const words = nameWords(value);
  return PARTS.map((_, index) => words[index] ?? '');
}

function valueFromParts(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(' ');
}

function wrongScript(raw: string, script: 'en' | 'ar') {
  if (!raw) return false;
  return script === 'en' ? ARABIC_CHAR.test(raw) : LATIN_CHAR.test(raw);
}

export function NameField({ label, value, onChangeText, script, soft, compact }: Props) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const inputs = useRef<Array<TextInput | null>>([]);
  const [parts, setParts] = useState(() => partsFromValue(value));
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(0);
  const [scriptError, setScriptError] = useState(false);
  const ltr = script === 'en';
  const lang = ltr ? 'en' : 'ar';
  const errorText = t(ltr ? 'profile.nameNoArabic' : 'profile.nameNoEnglish');

  useEffect(() => {
    if (cleanName(value) === valueFromParts(partsRef.current)) return;
    const next = partsFromValue(value);
    partsRef.current = next;
    setParts(next);
  }, [value]);

  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    [],
  );

  const showScriptError = () => {
    setScriptError(true);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setScriptError(false), 4000);
  };

  const noteIncoming = (raw: string) => {
    if (wrongScript(raw, script)) showScriptError();
  };

  const focusAt = (index: number) => {
    const next = Math.max(0, Math.min(index, NAME_WORD_MAX - 1));
    inputs.current[next]?.focus();
    setActive(next);
  };

  const emit = (next: string[]) => {
    partsRef.current = next;
    setParts(next);
    onChangeText(valueFromParts(next));
  };

  const apply = (index: number, raw: string) => {
    noteIncoming(raw);
    const next = [...partsRef.current];
    if (/\s/.test(raw)) {
      const chunks = raw
        .split(/\s+/)
        .map((chunk) => sanitizePart(chunk, script))
        .filter(Boolean);
      if (chunks.length === 0) {
        next[index] = '';
        emit(next);
        return;
      }
      chunks.forEach((chunk, offset) => {
        const slot = index + offset;
        if (slot < NAME_WORD_MAX) next[slot] = chunk;
      });
      emit(next);
      focusAt(index + chunks.length);
      return;
    }
    next[index] = sanitizePart(raw, script);
    emit(next);
  };

  const renderSlot = (index: number) => {
    const focused = active === index;
    const filled = Boolean(parts[index]);
    return (
      <View key={PARTS[index]} style={styles.slotWrap}>
        <TextInput
          ref={(node) => {
            inputs.current[index] = node;
          }}
          value={parts[index]}
          onChangeText={(raw) => apply(index, raw)}
          // Android often skips onChangeText for stripped characters.
          {...{
            onTextInput: (event: { nativeEvent: { text: string } }) => noteIncoming(event.nativeEvent.text),
          }}
          onFocus={() => {
            const firstEmpty = partsRef.current.findIndex((part) => !part);
            if (firstEmpty >= 0 && firstEmpty < index && !partsRef.current[index]) {
              focusAt(firstEmpty);
              return;
            }
            setActive(index);
          }}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && !partsRef.current[index] && index > 0) {
              focusAt(index - 1);
              return;
            }
            noteIncoming(nativeEvent.key);
          }}
          onSubmitEditing={() => {
            if (index < NAME_WORD_MAX - 1) focusAt(index + 1);
          }}
          placeholder={t(`profile.${PARTS[index]}`, { lng: lang })}
          placeholderTextColor={colors.textMuted}
          autoCapitalize={ltr ? 'words' : 'none'}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType={index === NAME_WORD_MAX - 1 ? 'done' : 'next'}
          blurOnSubmit={index === NAME_WORD_MAX - 1}
          maxLength={24}
          textAlign={ltr ? 'left' : 'right'}
          style={[
            styles.slot,
            soft ? styles.soft : null,
            compact ? styles.slotCompact : null,
            {
              writingDirection: ltr ? 'ltr' : 'rtl',
              backgroundColor: scriptError && focused ? colors.dangerSoft : focused ? colors.primarySoft : soft ? colors.surfaceMuted : colors.surface,
              borderColor: scriptError
                ? colors.danger
                : focused || filled
                  ? colors.primary
                  : soft
                    ? 'transparent'
                    : colors.border,
              color: colors.text,
            },
          ]}
        />
      </View>
    );
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact, rtlText, { color: colors.text }]}>{label}</Text>
      {scriptError ? (
        <View style={[styles.error, compact && styles.errorCompact, row, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="alert-circle" size={compact ? 14 : 16} color={colors.danger} />
          <Text style={[styles.errorText, compact && styles.errorTextCompact, rtlText, { color: colors.danger }]}>
            {errorText}
          </Text>
        </View>
      ) : null}
      <View style={[styles.grid, compact && styles.gridCompact, { direction: ltr ? 'ltr' : 'rtl' }]}>
        <View style={[styles.row, compact && styles.rowCompact]}>
          {renderSlot(0)}
          {renderSlot(1)}
        </View>
        <View style={[styles.row, compact && styles.rowCompact]}>
          {renderSlot(2)}
          {renderSlot(3)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  wrapCompact: { gap: 5 },
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  labelCompact: { fontSize: 12 },
  grid: { gap: 8 },
  gridCompact: { gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  rowCompact: { gap: 6 },
  slotWrap: { flex: 1, minWidth: 0, overflow: 'hidden' },
  slot: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 52,
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlignVertical: 'center',
    includeFontPadding: false,
    overflow: 'hidden',
  },
  slotCompact: {
    height: 40,
    paddingHorizontal: 8,
    fontSize: 13,
    borderRadius: radius.sm,
  },
  soft: {
    borderRadius: radius.full,
    height: 54,
    borderColor: 'transparent',
  },
  error: {
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  errorCompact: { gap: 6, paddingVertical: 6 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_600SemiBold' },
  errorTextCompact: { fontSize: 12, lineHeight: 16 },
});
