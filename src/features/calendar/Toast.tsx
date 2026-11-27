import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Button, Txt } from '@/ui/primitives';
import { radius, useTheme } from '@/ui/theme';

import { performUndo } from './actions';
import { useUi } from './ui-store';

export function Toast() {
  const t = useTheme();
  const T = useT();
  const toast = useUi((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useUi.getState().hideToast(), toast.undo ? 6000 : 3500);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: t.scheme === 'dark' ? t.surfaceAlt : '#1F2025', shadowColor: t.shadow }]}
      >
        <Txt size="sm" color="#F4F4F6" style={{ flexShrink: 1 }}>
          {toast.message}
        </Txt>
        {toast.undo ? (
          <Button
            label={T('undo')}
            size="sm"
            variant="ghost"
            onPress={() => {
              useUi.getState().hideToast();
              performUndo();
            }}
            fg="#9DB1FF"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 44,
    borderRadius: radius.lg,
    maxWidth: 520,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
});
