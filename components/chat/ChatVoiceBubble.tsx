import Ionicons from '@expo/vector-icons/Ionicons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { chatPhotoUrl } from '@/src/lib/upload';
import { useColors } from '@/src/theme/ThemeProvider';

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ChatVoiceBubble({
  pathOrUrl,
  mine,
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
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    let alive = true;
    void chatPhotoUrl(pathOrUrl).then((next) => {
      if (alive && next) setUri(next);
    });
    return () => {
      alive = false;
    };
  }, [pathOrUrl]);

  useEffect(() => {
    if (uri) player.replace(uri);
  }, [player, uri]);

  const playing = Boolean(status.playing);
  const duration = (status.duration ?? 0) * 1000;
  const current = (status.currentTime ?? 0) * 1000;
  const shown = playing || current > 0 ? current : duration;
  const tint = mine ? colors.white : colors.primary;

  return (
    <Pressable
      onPress={() => {
        if (!uri) return;
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
      <View style={[styles.play, { backgroundColor: mine ? 'rgba(255,255,255,0.18)' : colors.primarySoft }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={16} color={tint} />
      </View>
      <View style={[styles.bar, { backgroundColor: mine ? 'rgba(255,255,255,0.28)' : colors.border }]}>
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
      <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.9)' : colors.text }]}>
        {formatMs(shown || 0)}
      </Text>
    </Pressable>
  );
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
