import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ChatThread } from '@/components/ChatThread';
import { BackButton } from '@/components/ui/BackButton';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { loadConversation, otherPerson, personName } from '@/src/lib/chat';
import { colors, spacing } from '@/src/theme/colors';

export default function OwnerConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { rtlText, isRtl } = useLayout();
  const { profile } = useAuth();
  const [title, setTitle] = useState(t('chat.title'));

  useEffect(() => {
    if (!id) return;
    void loadConversation(id)
      .then((conversation) => {
        const name = personName(otherPerson(conversation, profile?.id));
        setTitle(name || t('chat.unknownPerson'));
      })
      .catch(() => setTitle(t('chat.unknownPerson')));
  }, [id, profile?.id, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <BackButton />
        <Text style={[styles.title, rtlText]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {id ? <ChatThread conversationId={id} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 8,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
});
