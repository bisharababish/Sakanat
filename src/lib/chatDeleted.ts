import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sakanat.chatDeleted';
const MAX_IDS = 250;

async function readMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function rememberDeletedMessage(conversationId: string, messageId: string) {
  const map = await readMap();
  const next = [messageId, ...(map[conversationId] ?? []).filter((id) => id !== messageId)].slice(0, MAX_IDS);
  map[conversationId] = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

export async function deletedMessageIds(conversationId: string) {
  const map = await readMap();
  return new Set(map[conversationId] ?? []);
}

const PIN_KEY = 'sakanat.chatListingPin';

async function readPins() {
  try {
    const raw = await AsyncStorage.getItem(PIN_KEY);
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [] as string[];
  }
}

export async function pinListingContext(conversationId: string) {
  const pins = await readPins();
  if (pins.includes(conversationId)) return;
  await AsyncStorage.setItem(PIN_KEY, JSON.stringify([conversationId, ...pins].slice(0, 200)));
}

export async function unpinListingContext(conversationId: string) {
  const pins = await readPins();
  await AsyncStorage.setItem(PIN_KEY, JSON.stringify(pins.filter((id) => id !== conversationId)));
}

export async function isListingContextPinned(conversationId: string) {
  const pins = await readPins();
  return pins.includes(conversationId);
}

export async function pinnedListingConversationIds() {
  return new Set(await readPins());
}
