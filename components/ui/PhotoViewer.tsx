import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/src/theme/ThemeProvider';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { shareRemoteFile } from '@/src/lib/mediaSave';
import { alert } from '@/src/lib/notice';

export function PhotoViewer({
  photos,
  index,
  visible,
  onIndexChange,
  onClose,
}: {
  photos: string[];
  index: number;
  visible: boolean;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const safe = useModalSafeArea();
  useEdgeBack(visible, onClose);
  const scroller = useRef<ScrollView>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const [saving, setSaving] = useState(false);
  const barH = 56 + safe.bottom;
  const imageH = Math.max(height - barH, 200);

  const saveCurrent = async () => {
    const uri = photos[index];
    if (!uri || saving) return;
    setSaving(true);
    try {
      await shareRemoteFile(uri, `sakanat-${Date.now()}.jpg`, 'image/jpeg', 'public.jpeg');
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('chat.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ x: indexRef.current * width, animated: false });
    });
  }, [visible, width]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < photos.length) onIndexChange(next);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          style={styles.ltr}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        >
          {photos.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ width, height: imageH }}
              contentFit="contain"
              pointerEvents="none"
            />
          ))}
        </ScrollView>
        <View
          style={[
            styles.bar,
            {
              paddingBottom: safe.bottom + 10,
              paddingLeft: 16 + safe.left,
              paddingRight: 16 + safe.right,
            },
          ]}
        >
          <Pressable
            onPress={() => void saveCurrent()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('chat.savePhoto')}
            style={styles.action}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="download-outline" size={22} color={colors.white} />
            )}
          </Pressable>
          <Text style={[styles.count, { color: colors.white }]}>
            {t('listing.photoIndex', { current: index + 1, total: Math.max(photos.length, 1) })}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={styles.action}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' },
  ltr: { direction: 'ltr', flex: 1 },
  bar: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  count: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
  },
  action: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});
