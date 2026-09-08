import AsyncStorage from '@react-native-async-storage/async-storage';

import { sendMessage } from '@/src/lib/chat';
import { uploadChatPhoto } from '@/src/lib/upload';

const KEY = 'sakanat.chatOutbox';

export type ChatOutboxItem = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imageUri?: string | null;
  imageUrl?: string | null;
  createdAt: string;
};

async function readQueue(): Promise<ChatOutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatOutboxItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: ChatOutboxItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, 40)));
}

export async function enqueueChatOutbox(item: ChatOutboxItem) {
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
}

export async function flushChatOutbox() {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, left: 0 };
  const remaining: ChatOutboxItem[] = [];
  let sent = 0;
  for (const item of queue) {
    try {
      let imageUrl = item.imageUrl ?? null;
      if (!imageUrl && item.imageUri) {
        imageUrl = await uploadChatPhoto(item.senderId, item.conversationId, item.imageUri);
      }
      await sendMessage(item.conversationId, item.senderId, item.body, imageUrl);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return { sent, left: remaining.length };
}

export async function outboxCount() {
  return (await readQueue()).length;
}
