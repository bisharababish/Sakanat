import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatThread } from '@/components/ChatThread';
import { conversationParties, deleteConversation, loadConversation, personName } from '@/src/lib/chat';
import { alert } from '@/src/lib/notice';
import { seekerRoleLabel } from '@/src/lib/seeker';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

export default function AdminConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadConversation(id)
      .then(setConversation)
      .catch(() => setConversation(null));
  }, [id]);

  const { student, owner } = conversationParties(conversation);

  const remove = () => {
    if (!id) return;
    alert(t('admin.deleteConversation'), t('admin.confirmDeleteConversation'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteConversation(id);
            if (router.canGoBack()) router.back();
            else router.replace('/(admin)/(tabs)/chat');
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {id ? <ChatHeader conversationId={id} admin onDelete={remove} /> : null}
      {id ? (
        <ChatThread
          conversationId={id}
          readOnly
          studentId={conversation?.student_id}
          ownerId={conversation?.owner_id}
          studentName={personName(student) || seekerRoleLabel(student?.role, t)}
          ownerName={personName(owner) || t('roles.owner')}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
