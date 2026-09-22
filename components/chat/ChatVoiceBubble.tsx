import Ionicons from '@expo/vector-icons/Ionicons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { chatPhotoUrl } from '@/src/lib/upload';
import { useColors } from '@/src/theme/ThemeProvider';

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function VoicePlay({
  uri,
  onLongPress,
}: {
  uri: string;
  onLongPress?: () => void;
}) {
  const colors = useColors();
  const { row } = useLayout();
  const remote = uri.startsWith('http://') || uri.startsWith('https://');
  const player = useAudioPlayer({ uri }, { updateInterval: 200, downloadFirst: remote });
  const status = useAudioPlayerStatus(player);
  const playing = Boolean(status.playing);
  const duration = (status.duration ?? 0) * 1000;
  const current = (status.currentTime ?? 0) * 1000;
  const shown = playing || current > 0 ? current : duration;
  const tint = colors.primary;

  return (
    <Pressable
      onPress={() => {
        if (playing) {
          player.pause();
          return;
        }
        void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).then(() => {
          if (status.didJustFinish || (status.duration && status.currentTime >= status.duration - 0.05)) {
            player.seekTo(0);
          }
          player.play();
        });
      }}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      style={[styles.row, row]}
    >
      <View style={[styles.play, { backgroundColor: colors.surface }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={16} color={tint} />
      </View>
      <View style={[styles.bar, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, duration > 0 ? (current / duration) * 100 : 0)}%`,
              backgroundColor: tint,
            },
          ]}
        />
      </View>
      <Text style={[styles.time, { color: colors.text }]}>{formatMs(shown || 0)}</Text>
    </Pressable>
  );
}

export function ChatVoiceBubble({
  pathOrUrl,
  mine: _mine,
  onLongPress,
}: {
  pathOrUrl: string;
  mine: boolean;
  onLongPress?: () => void;
}) {
  const colors = useColors();
  const { row } = useLayout();
  const [uri, setUri] = useState<string | null>(
    pathOrUrl.startsWith('http') || pathOrUrl.startsWith('file:') ? pathOrUrl : null,
  );

  useEffect(() => {
    let alive = true;
    void chatPhotoUrl(pathOrUrl).then((next) => {
      if (alive && next) setUri(next);
    });
    return () => {
      alive = false;
    };
  }, [pathOrUrl]);

  if (!uri) {
    return (
      <View style={[styles.row, row]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return <VoicePlay key={uri} uri={uri} onLongPress={onLongPress} />;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 8, minWidth: 168 },
  play: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  time: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', minWidth: 36 },
});
