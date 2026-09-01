import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatThread } from '@/components/ChatThread';
import { useColors } from '@/src/theme/ThemeProvider';

export default function OwnerConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {id ? <ChatHeader conversationId={id} /> : null}
      {id ? <ChatThread conversationId={id} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
