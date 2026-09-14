import Constants from 'expo-constants';
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Insets for edge-to-edge / translucent modals.
 * SafeAreaView inside a Modal often reports 0, which puts close/save under the
 * iPhone notch, Dynamic Island, or Android status bar.
 */
export function useModalSafeArea() {
  const insets = useSafeAreaInsets();
  const fallbackTop =
    Constants.statusBarHeight ||
    (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 54);
  return {
    top: Math.max(insets.top, fallbackTop, 12),
    bottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12),
    left: insets.left,
    right: insets.right,
  };
}
