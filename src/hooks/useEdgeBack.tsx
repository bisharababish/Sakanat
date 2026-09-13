import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  BackHandler,
  Dimensions,
  PanResponder,
  View,
  type GestureResponderHandlers,
} from 'react-native';
import { router } from 'expo-router';

import { goBack } from '@/components/ui/BackButton';

const EDGE = 32;
const MIN_DX = 52;

type Entry = { id: number; run: () => void };

type Api = {
  register: (id: number, run: () => void) => void;
  unregister: (id: number) => void;
  perform: () => boolean;
};

const EdgeBackContext = createContext<Api>({
  register: () => {},
  unregister: () => {},
  perform: () => false,
});

function edgeSwipe(dx: number, dy: number, x0: number) {
  const width = Dimensions.get('window').width;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;
  if (!horizontal) return false;
  if (x0 <= EDGE && dx > 12) return true;
  if (x0 >= width - EDGE && dx < -12) return true;
  return false;
}

function edgeCommit(dx: number, vx: number, x0: number) {
  const width = Dimensions.get('window').width;
  if (x0 <= EDGE) return dx > MIN_DX || vx > 0.4;
  if (x0 >= width - EDGE) return dx < -MIN_DX || vx < -0.4;
  return false;
}

function makePan(canHandle: () => boolean, perform: () => boolean) {
  return PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      canHandle() && edgeSwipe(gesture.dx, gesture.dy, gesture.x0),
    onPanResponderRelease: (_, gesture) => {
      if (edgeCommit(gesture.dx, gesture.vx, gesture.x0)) perform();
    },
  });
}

export function EdgeBackProvider({ children }: { children: ReactNode }) {
  const stack = useRef<Entry[]>([]);

  const perform = useCallback(() => {
    const top = stack.current[stack.current.length - 1];
    if (top) {
      top.run();
      return true;
    }
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    return false;
  }, []);

  const register = useCallback((id: number, run: () => void) => {
    stack.current = [...stack.current.filter((item) => item.id !== id), { id, run }];
  }, []);

  const unregister = useCallback((id: number) => {
    stack.current = stack.current.filter((item) => item.id !== id);
  }, []);

  const canHandle = useCallback(() => stack.current.length > 0 || router.canGoBack(), []);

  const pan = useMemo(() => makePan(canHandle, perform), [canHandle, perform]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => perform());
    return () => sub.remove();
  }, [perform]);

  const value = useMemo(() => ({ register, unregister, perform }), [register, unregister, perform]);

  return (
    <EdgeBackContext.Provider value={value}>
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        {children}
      </View>
    </EdgeBackContext.Provider>
  );
}

let nextId = 1;

export function useEdgeBack(enabled: boolean, onBack?: () => void): GestureResponderHandlers {
  const ctx = useContext(EdgeBackContext);
  const id = useRef(0);
  if (id.current === 0) id.current = nextId++;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const go = useCallback(() => {
    (onBackRef.current ?? goBack)();
  }, []);

  useEffect(() => {
    if (!enabled) {
      ctx.unregister(id.current);
      return;
    }
    ctx.register(id.current, go);
    return () => ctx.unregister(id.current);
  }, [ctx, enabled, go]);

  const pan = useMemo(
    () =>
      makePan(
        () => enabled,
        () => {
          go();
          return true;
        },
      ),
    [enabled, go],
  );

  return enabled ? pan.panHandlers : {};
}
