import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Conversation } from '@/src/types/database';

export function ConversationList({ roleHref }: { roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]' }) {
  const { t, i18n } = useTranslation();
  const { textAlign } = useLayout();
  const { profile } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const column = profile.role === 'owner' ? 'owner_id' : 'student_id';
    const { data } = await supabase
      .from('conversations')
      .select('*, apartments(id, title_ar, title_en, photos)')
      .eq(column, profile.id)
      .order('last_message_at', { ascending: false });
    setItems((data as Conversation[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (items.length === 0) return <EmptyState title={t('chat.empty')} />;

  return (
    <>
      {items.map((item) => (
        <Card
          key={item.id}
          onPress={() => router.push({ pathname: roleHref, params: { id: item.id } })}>
          <Text style={[styles.title, { textAlign }]}>{localizedTitle(item.apartments, i18n.language)}</Text>
          <Text style={[styles.preview, { textAlign }]} numberOfLines={2}>
            {item.last_message || '—'}
          </Text>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  preview: { color: colors.textMuted },
});
