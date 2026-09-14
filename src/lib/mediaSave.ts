import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

export async function shareRemoteFile(uri: string, filename: string, mimeType: string, uti: string) {
  const safe = filename.replace(/[^\w.-]+/g, '_');
  const dest = `${FileSystem.cacheDirectory}${safe}`;
  const local = uri.startsWith('file:')
    ? uri
    : (await FileSystem.downloadAsync(uri, dest)).uri;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(local, { mimeType, dialogTitle: safe, UTI: uti });
    return;
  }
  await Share.share({ url: local, message: safe });
}
