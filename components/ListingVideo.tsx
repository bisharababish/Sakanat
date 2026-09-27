import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

import { radius } from '@/src/theme/colors';

export function ListingVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (item) => {
    item.loop = false;
  });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
});
