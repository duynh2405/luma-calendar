/**
 * Base UI components of the design system. Keep this file small and generic;
 * feature-specific UI lives under src/features.
 */
import type { LucideIcon } from 'lucide-react-native';
import { type ComponentRef, type ReactNode, forwardRef } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { font, radius, space, text, type Theme, useTheme } from './theme';

// --- Text ---------------------------------------------------------------------

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
interface TxtProps extends TextProps {
  size?: keyof typeof text;
  weight?: Weight;
  color?: keyof Theme | string;
  tabular?: boolean;
}

export function Txt({ size = 'md', weight = 'regular', color = 'text', tabular, style, ...rest }: TxtProps) {
  const t = useTheme();
  const c = color in t ? (t[color as keyof Theme] as string) : color;
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: font[weight], fontSize: text[size], color: c, lineHeight: Math.round(text[size] * 1.4) },
        tabular && ({ fontVariant: ['tabular-nums'] } as TextStyle),
        style,
      ]}
    />
  );
}

// --- Buttons ------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label?: string;
  icon?: LucideIcon;
  variant?: Variant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  title?: string;
  /** Override the foreground color (e.g. on a dark toast). */
  fg?: string;
}

export function Button({ label, icon: Icon, variant = 'secondary', size = 'md', style, title, disabled, fg, ...rest }: ButtonProps) {
  const t = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border: string; hover: string }> = {
    primary: { bg: t.accent, fg: t.accentText, border: t.accent, hover: t.accent },
    secondary: { bg: t.bg, fg: t.text, border: t.borderStrong, hover: t.surfaceHover },
    ghost: { bg: 'transparent', fg: t.text, border: 'transparent', hover: t.surfaceAlt },
    danger: { bg: t.bg, fg: t.danger, border: t.borderStrong, hover: t.dangerSoft },
  };
  const p = { ...palette[variant], ...(fg ? { fg } : {}) };
  const h = size === 'sm' ? 30 : 36;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title ?? label}
      disabled={disabled}
      {...(Platform.OS === 'web' && title ? ({ title } as object) : {})}
      {...rest}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.button,
        {
          height: h,
          paddingHorizontal: label ? (size === 'sm' ? space.sm + 2 : space.md) : 0,
          width: label ? undefined : h,
          backgroundColor: hovered || pressed ? p.hover : p.bg,
          borderColor: p.border,
          opacity: disabled ? 0.45 : pressed && variant === 'primary' ? 0.88 : 1,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={size === 'sm' ? 16 : 18} color={p.fg} strokeWidth={1.75} /> : null}
      {label ? (
        <Txt size={size === 'sm' ? 'sm' : 'md'} weight="medium" color={p.fg} numberOfLines={1}>
          {label}
        </Txt>
      ) : null}
    </Pressable>
  );
}

export function IconButton(props: Omit<ButtonProps, 'label'> & { icon: LucideIcon; title: string }) {
  return <Button variant="ghost" {...props} />;
}

// --- Inputs -------------------------------------------------------------------

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  large?: boolean;
}

export const Field = forwardRef<ComponentRef<typeof TextInput>, FieldProps>(function Field({ label, error, large, style, ...rest }, ref) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {label ? (
        <Txt size="sm" color="textMuted" weight="medium">
          {label}
        </Txt>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={t.textFaint}
        {...rest}
        style={[
          styles.input,
          {
            borderColor: error ? t.danger : t.borderStrong,
            color: t.text,
            backgroundColor: t.bg,
            fontFamily: large ? font.semibold : font.regular,
            fontSize: large ? text.xl : text.md,
            minHeight: large ? 44 : 36,
          },
          rest.multiline && { minHeight: 80, paddingTop: 8, textAlignVertical: 'top' },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
          style,
        ]}
      />
      {error ? (
        <Txt size="sm" color="danger">
          {error}
        </Txt>
      ) : null}
    </View>
  );
});

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <View style={[styles.track, { backgroundColor: value ? t.accent : t.borderStrong }]}>
        <View style={[styles.thumb, { transform: [{ translateX: value ? 16 : 0 }], backgroundColor: '#fff' }]} />
      </View>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              { height: size === 'sm' ? 26 : 30 },
              active && { backgroundColor: t.bg, shadowColor: t.shadow, shadowOpacity: 1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
            ]}
          >
            <Txt size="sm" weight={active ? 'semibold' : 'medium'} color={active ? 'text' : 'textMuted'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Dialog -------------------------------------------------------------------

export function Dialog({
  visible,
  onClose,
  title,
  children,
  footer,
  width = 440,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="close" />
      <View style={styles.dialogWrap} pointerEvents="box-none">
        <View
          accessibilityRole={Platform.OS === 'web' ? ('dialog' as never) : undefined}
          style={[styles.dialog, { backgroundColor: t.bg, borderColor: t.border, maxWidth: width, shadowColor: t.shadow }]}
        >
          <View style={[styles.dialogHeader, { borderBottomColor: t.border }]}>
            <Txt size="lg" weight="semibold">
              {title}
            </Txt>
          </View>
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
            {children}
          </ScrollView>
          {footer ? <View style={[styles.dialogFooter, { borderTopColor: t.border }]}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  track: { width: 36, height: 20, borderRadius: 10, padding: 2 },
  thumb: { width: 16, height: 16, borderRadius: 8 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 2, gap: 2 },
  segment: { paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  dialogWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  dialog: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    overflow: 'hidden',
  },
  dialogHeader: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1 },
  dialogFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
  },
});

// --- Pressable with hover state (web) ----------------------------------------

type HoverState = { hovered?: boolean; pressed: boolean };
interface HoverPressableProps extends Omit<PressableProps, 'style'> {
  style: (s: HoverState) => StyleProp<ViewStyle>;
}

/** Pressable whose style callback also receives `hovered` (provided by react-native-web). */
export function HoverPressable({ style, ...rest }: HoverPressableProps) {
  return <Pressable {...rest} style={style as PressableProps['style']} />;
}
