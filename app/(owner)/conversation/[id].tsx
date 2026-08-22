import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ChatThread } from '@/components/ChatThread';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, spacing } from '@/src/theme/colors';

export default function OwnerConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { textAlign } = useLayout();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { textAlign }]}>{t('chat.title')}</Text>
      </View>
      {id ? <ChatThread conversationId={id} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
});
