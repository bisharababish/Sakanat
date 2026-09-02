import * as ImagePicker from 'expo-image-picker';

import i18n from '@/src/i18n';
import { PHOTO_MAX_BYTES } from '@/src/lib/limits';
import { alert } from '@/src/lib/notice';

function confirm(title: string, message: string, confirmTitle: string) {
  return new Promise<boolean>((resolve) => {
    alert(title, message, [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmTitle, onPress: () => resolve(true) },
    ]);
  });
}

function withinSize(size?: number | null) {
  if (size == null || size <= 0) return true;
  return size <= PHOTO_MAX_BYTES;
}

export async function pickProfilePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  if (!withinSize(result.assets[0].fileSize)) {
    alert(i18n.t('common.error'), i18n.t('profile.photoTooLarge'));
    return null;
  }
  const ok = await confirm(
    i18n.t('profile.confirmPhoto'),
    i18n.t('profile.confirmPhotoBody'),
    i18n.t('profile.usePhoto'),
  );
  return ok ? result.assets[0].uri : null;
}

export async function pickListingPhotos(remaining: number) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    alert(i18n.t('common.error'), i18n.t('owner.photoPermission'));
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, remaining),
  });
  if (result.canceled || !result.assets.length) return [];
  const usable = result.assets.filter((asset) => withinSize(asset.fileSize));
  if (usable.length < result.assets.length) {
    alert(i18n.t('common.error'), i18n.t('owner.photoTooLarge'));
    if (usable.length === 0) return [];
  }
  const count = usable.length;
  const ok = await confirm(
    count === 1 ? i18n.t('owner.confirmPhoto') : i18n.t('owner.confirmPhotos'),
    count === 1 ? i18n.t('owner.confirmPhotoBody') : i18n.t('owner.confirmPhotosBody', { count }),
    count === 1 ? i18n.t('owner.usePhoto') : i18n.t('owner.usePhotos'),
  );
  return ok ? usable.map((asset) => asset.uri) : [];
}
