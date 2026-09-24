import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { emitNameParts, NAME_MIN, NAME_WORD_MAX, nameParts, sanitizeNamePart } from '@/src/lib/name';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

const ARABIC_CHAR =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_CHAR = /[A-Za-z]/;
const PART_KEYS = ['nameFirst', 'nameSecond', 'nameThird', 'nameLast'] as const;

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  script: 'en' | 'ar';
  soft?: boolean;
  compact?: boolean;
};

function wrongScript(raw: string, script: 'en' | 'ar') {
  if (!raw) return false;
  return script === 'en' ? ARABIC_CHAR.test(raw) : LATIN_CHAR.test(raw);
}

function lettersIn(part: string) {
  return part.replace(/['\-]/g, '').replace(/\p{M}/gu, '').length;
}

export function NameField({ label, value, onChangeText, script, soft, compact }: Props) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const inputs = useRef<Array<TextInput | null>>([]);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [scriptError, setScriptError] = useState(false);
  const ltr = script === 'en';
  const lang = ltr ? 'en' : 'ar';
  const errorText = t(ltr ? 'profile.nameNoArabic' : 'profile.nameNoEnglish');
  const parts = nameParts(value);
  const filled = Boolean(value.trim());

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
    if (index < 0 || index >= NAME_WORD_MAX) return;
    requestAnimationFrame(() => inputs.current[index]?.focus());
  };

  const applySlot = (index: number, raw: string) => {
    noteIncoming(raw);
    const next = nameParts(value);
    const hasSpace = /[ \t]/.test(raw);

    // Normal typing in one box — never touch other slots.
    if (!hasSpace) {
      next[index] = sanitizeNamePart(raw, script);
      onChangeText(emitNameParts(next));
      return;
    }

    const chunks = raw
      .split(/[ \t]+/)
      .map((chunk) => sanitizeNamePart(chunk, script))
      .filter(Boolean);

    // Trailing space after a real word → keep this slot, advance focus only.
    if (chunks.length <= 1 && /[ \t]$/.test(raw)) {
      if (chunks[0]) next[index] = chunks[0];
      else next[index] = sanitizeNamePart(raw.replace(/[ \t]+$/g, ''), script);
      onChangeText(emitNameParts(next));
      if (lettersIn(next[index] ?? '') >= NAME_MIN) focusAt(index + 1);
      return;
    }

    // Multi-word paste into this slot → fill forward from here only.
    if (!chunks.length) {
      next[index] = '';
      onChangeText(emitNameParts(next));
      return;
    }
    chunks.slice(0, NAME_WORD_MAX - index).forEach((chunk, offset) => {
      next[index + offset] = chunk;
    });
    onChangeText(emitNameParts(next));
    const lastFilled = index + Math.min(chunks.length, NAME_WORD_MAX - index) - 1;
    focusAt(/[ \t]$/.test(raw) ? lastFilled + 1 : lastFilled);
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
      <View
        style={[
          styles.field,
          soft ? styles.soft : null,
          compact ? styles.fieldCompact : null,
          ltr ? styles.ltr : styles.rtl,
          {
            backgroundColor:
              scriptError && focused != null
                ? colors.dangerSoft
                : focused != null
                  ? colors.primarySoft
                  : soft
                    ? colors.surfaceMuted
                    : colors.surface,
            borderColor: scriptError
              ? colors.danger
              : focused != null || filled
                ? colors.primary
                : soft
                  ? 'transparent'
                  : colors.border,
          },
        ]}
      >
        {PART_KEYS.map((key, index) => {
          const active = focused === index;
          const slotFilled = Boolean(parts[index]);
          return (
            <View
              key={key}
              style={[
                styles.slot,
                compact && styles.slotCompact,
                {
                  backgroundColor: active ? colors.surface : soft ? colors.surface : colors.surfaceMuted,
                  borderColor:
                    scriptError && active ? colors.danger : active ? colors.primary : slotFilled ? colors.border : 'transparent',
                },
              ]}
            >
              <TextInput
                ref={(node) => {
                  inputs.current[index] = node;
                }}
                value={parts[index]}
                onChangeText={(text) => applySlot(index, text)}
                {...{
                  onTextInput: (event: { nativeEvent: { text: string } }) => noteIncoming(event.nativeEvent.text),
                }}
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused((current) => (current === index ? null : current))}
                onSubmitEditing={() => focusAt(index + 1)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key !== 'Backspace' || parts[index] || index === 0) return;
                  focusAt(index - 1);
                }}
                placeholder={t(`profile.${key}`, { lng: lang })}
                placeholderTextColor={colors.textMuted}
                autoCapitalize={ltr ? 'words' : 'none'}
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                returnKeyType={index === 3 ? 'done' : 'next'}
                blurOnSubmit={index === 3}
                maxLength={24}
                textAlign={ltr ? 'left' : 'right'}
                style={[
                  styles.input,
                  compact && styles.inputCompact,
                  {
                    writingDirection: ltr ? 'ltr' : 'rtl',
                    color: colors.text,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, maxWidth: '100%' },
  wrapCompact: { gap: 4 },
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  labelCompact: { fontSize: 12 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 6,
    height: 56,
    gap: 6,
    overflow: 'hidden',
  },
  fieldCompact: {
    height: 44,
    padding: 4,
    gap: 4,
    borderRadius: radius.sm,
  },
  soft: {
    borderRadius: radius.full,
    height: 58,
    borderColor: 'transparent',
  },
  ltr: { direction: 'ltr' },
  rtl: { direction: 'rtl' },
  slot: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    borderWidth: 1,
    borderRadius: radius.sm,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  slotCompact: {
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  input: {
    padding: 0,
    margin: 0,
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  inputCompact: { fontSize: 12 },
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
