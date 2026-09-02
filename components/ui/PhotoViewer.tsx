import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/src/theme/ThemeProvider';

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
  const scroller = useRef<ScrollView>(null);
  const indexRef = useRef(index);
  indexRef.current = index;

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
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.top}>
            <Text style={[styles.count, { color: colors.white }]}>
              {t('listing.photoIndex', { current: index + 1, total: photos.length })}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>
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
                style={{ width, height: height - 120 }}
                contentFit="contain"
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  ltr: { direction: 'ltr' },
  top: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  count: { fontSize: 15, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});
