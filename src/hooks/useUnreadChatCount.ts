import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/lib/auth';
import { isConversationUnread, markInboxDelivered } from '@/src/lib/chat';
import { supabase } from '@/src/lib/supabase';
import type { Conversation } from '@/src/types/database';

export function useUnreadChatCount() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!profile?.id) {
      setCount(0);
      return;
    }
    const column = profile.role === 'owner' ? 'owner_id' : 'student_id';
    const { data, error } = await supabase
      .from('conversations')
      .select(
        'id, student_id, owner_id, last_message, last_message_at, student_last_read_at, owner_last_read_at, student_delivered_at, owner_delivered_at',
      )
      .eq(column, profile.id);
    if (error) {
      setCount(0);
      return;
    }
    const rows = (data as Conversation[]) ?? [];
    setCount(rows.filter((item) => isConversationUnread(item, profile.id)).length);
    void markInboxDelivered(rows, profile.role === 'owner');
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    void refresh();
    if (!profile?.id) return;
    const channel = supabase
      .channel(`unread-chats:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, refresh]);

  return count;
}
