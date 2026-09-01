import { StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';

export function AuthBrand({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.wrap, compact && styles.wrapSm]}>
      <BrandLogo size={compact ? 132 : 196} plate />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch', marginBottom: 8 },
  wrapSm: { marginBottom: 4 },
});
