import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { loadConversations, otherPerson, personName } from '@/src/lib/chat';
import { colors, radius } from '@/src/theme/colors';
import type { Conversation } from '@/src/types/database';

function formatWhen(iso: string, lang: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang.startsWith('ar') ? 'ar' : 'en', {
    day: 'numeric',
    month: 'short',
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function ConversationList({ roleHref }: { roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]' }) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const { profile } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const column = profile.role === 'owner' ? 'owner_id' : 'student_id';
    try {
      setItems(await loadConversations(column, profile.id));
    } catch {
      setItems([]);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (items.length === 0) return <EmptyState title={t('chat.empty')} />;

  return (
    <>
      {items.map((item) => {
        const person = otherPerson(item, profile?.id);
        const name = personName(person) || t('chat.unknownPerson');
        const photo = person?.avatar_url;
        return (
          <Card key={item.id} onPress={() => router.push({ pathname: roleHref, params: { id: item.id } })}>
            <View style={styles.row}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Text style={styles.initials}>{initials(name)}</Text>
                </View>
              )}
              <View style={styles.body}>
                <Text style={[styles.title, rtlText]}>{name}</Text>
                <Text style={[styles.preview, rtlText]} numberOfLines={2}>
                  {item.last_message || '—'}
                </Text>
                <Text style={[styles.when, rtlText]}>{formatWhen(item.last_message_at, i18n.language)}</Text>
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  photoFallback: { backgroundColor: colors.primarySoft },
  initials: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  preview: { color: colors.textMuted },
  when: { color: colors.textMuted, fontSize: 12 },
});
