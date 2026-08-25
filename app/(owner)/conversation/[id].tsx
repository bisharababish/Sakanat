import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatThread } from '@/components/ChatThread';
import { colors } from '@/src/theme/colors';

export default function OwnerConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {id ? <ChatHeader conversationId={id} /> : null}
      {id ? <ChatThread conversationId={id} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
