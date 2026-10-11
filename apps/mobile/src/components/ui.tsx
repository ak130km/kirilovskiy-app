import type { OrderStatus } from '@kirilovskiy/shared';
import { ORDER_STATUS_LABELS } from '@kirilovskiy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, radius, shadow, space } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  size = 'lg',
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  size?: 'lg' | 'md' | 'sm';
}) {
  const v = buttonVariants[variant];
  const h = size === 'lg' ? 54 : size === 'md' ? 44 : 34;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border, height: h, paddingHorizontal: size === 'sm' ? 12 : 18 },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={v.fg} /> : null}
          <Text style={[styles.buttonText, { color: v.fg, fontSize: size === 'sm' ? 14 : 16 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.card, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.card, fg: colors.danger, border: '#f1c4c4' },
};

export function QuantityStepper({
  value,
  onChange,
  compact,
  max = 50,
}: {
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
  max?: number;
}) {
  const size = compact ? 32 : 40;
  return (
    <View style={[styles.stepper, { height: size }]}>
      <Pressable accessibilityLabel="Меньше" onPress={() => onChange(value - 1)} style={[styles.stepBtn, { width: size, height: size }]} hitSlop={6}>
        <Ionicons name={value <= 1 ? 'trash-outline' : 'remove'} size={compact ? 16 : 20} color={colors.primary} />
      </Pressable>
      <Text style={[styles.stepValue, compact && { fontSize: 15, minWidth: 22 }]}>{value}</Text>
      <Pressable accessibilityLabel="Больше" onPress={() => value < max && onChange(value + 1)} style={[styles.stepBtn, { width: size, height: size }]} hitSlop={6}>
        <Ionicons name="add" size={compact ? 16 : 20} color={value >= max ? colors.muted : colors.primary} />
      </Pressable>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={font.h2}>{title}</Text>
      {action}
    </View>
  );
}

export function Chip({
  label,
  sublabel,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  sublabel?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected, disabled }}
      style={[styles.chip, selected && styles.chipOn, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.primaryDark }]}>{label}</Text>
      {sublabel ? <Text style={[font.small, { fontSize: 12 }, selected && { color: colors.primaryDark }]}>{sublabel}</Text> : null}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string | null; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#b9a79d" {...props} style={[styles.input, !!error && { borderColor: colors.danger }, props.multiline && { height: 90, paddingTop: 12, textAlignVertical: 'top' }]} />
      {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  NEW: { bg: '#e8f1fc', fg: '#2b6cb0' },
  CONFIRMED: { bg: '#eceafd', fg: '#4c3fb8' },
  PREPARING: { bg: colors.warningSoft, fg: colors.warning },
  READY: { bg: colors.successSoft, fg: colors.success },
  HANDED_TO_COURIER: { bg: '#e3f5f3', fg: '#18756b' },
  COMPLETED: { bg: '#f0ebe7', fg: '#6b5a51' },
  CANCELLED: { bg: colors.dangerSoft, fg: colors.danger },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{ORDER_STATUS_LABELS[status]}</Text>
    </View>
  );
}

export function Badge({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'danger' | 'success' | 'warning' }) {
  const map = {
    muted: { bg: '#f0ebe7', fg: '#6b5a51' },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={[font.h2, { textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[font.body, { color: colors.muted, textAlign: 'center' }]}>{text}</Text> : null}
      {action}
    </View>
  );
}

export function Loader() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Не удалось загрузить"
      text={message}
      action={onRetry ? <Button title="Повторить" variant="secondary" onPress={onRetry} size="md" /> : undefined}
    />
  );
}

export function Notice({ text, tone = 'warning', icon = 'information-circle-outline' }: { text: string; tone?: 'warning' | 'danger' | 'info' | 'success'; icon?: IconName }) {
  const map = {
    warning: { bg: colors.warningSoft, fg: '#6d4a0f' },
    danger: { bg: colors.dangerSoft, fg: '#8a1f1f' },
    info: { bg: '#e8f1fc', fg: '#1d4f85' },
    success: { bg: colors.successSoft, fg: '#1d5c3d' },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: map.bg }]}>
      <Ionicons name={icon} size={20} color={map.fg} />
      <Text style={{ color: map.fg, flex: 1, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[font.body, { color: strong ? colors.text : colors.muted }, strong && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[font.body, strong ? { fontWeight: '800', fontSize: 18 } : { fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: { fontWeight: '700' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
  },
  stepBtn: { alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 17, fontWeight: '700', minWidth: 26, textAlign: 'center', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, ...shadow },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    minWidth: 76,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md, flex: 1 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, alignItems: 'flex-start' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
});
