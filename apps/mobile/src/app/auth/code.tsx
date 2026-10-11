import type { CustomerAuthResponse, CustomerDto, OtpRequestResponse } from '@kirilovskiy/shared';
import { formatPhone } from '@kirilovskiy/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorText } from '@/api/client';
import { Button, Notice } from '@/components/ui';
import { registerForPush } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { colors, font, radius, space } from '@/theme';

export default function CodeScreen() {
  const params = useLocalSearchParams<{ phone: string; devCode?: string }>();
  const [devCode, setDevCode] = useState(params.devCode || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(60);
  const signIn = useSession((s) => s.signIn);
  const guestOrders = useSession((s) => s.guestOrders);
  const queryClient = useQueryClient();
  const input = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<CustomerAuthResponse>('/auth/otp/verify', { phone: params.phone, code: value }, { anonymous: true });
      await signIn(res.accessToken, res.customer);
      // Новому аккаунту подставляем имя из прошлого оформления заказа
      const savedName = useSession.getState().checkout.customerName;
      if (!res.customer.name && savedName) {
        const updated = await api.patch<CustomerDto>('/me', { name: savedName }).catch(() => null);
        if (updated) useSession.getState().setCustomer(updated);
      }
      // Гостевые заказы этого устройства попадают в историю аккаунта
      if (guestOrders.length) {
        await api.post('/me/orders/claim', { orders: guestOrders.map((o) => ({ id: o.id, accessToken: o.accessToken })) }).catch(() => undefined);
      }
      void registerForPush(false);
      void queryClient.invalidateQueries();
      router.dismissAll();
    } catch (e) {
      setError(errorText(e));
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const res = await api.post<OtpRequestResponse>('/auth/otp/request', { phone: params.phone }, { anonymous: true });
      setDevCode(res.devCode ?? '');
      setLeft(res.retryAfterSeconds);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={font.title}>Введите код</Text>
      <Text style={[font.body, { color: colors.muted }]}>Отправили SMS на {formatPhone(params.phone)}</Text>
      {devCode ? <Notice tone="info" text={`Режим разработки: SMS не отправляются. Ваш код — ${devCode}`} /> : null}
      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 4);
          setCode(digits);
          if (digits.length === 4) void verify(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={4}
        style={styles.code}
        placeholder="••••"
        placeholderTextColor={colors.border}
      />
      {error ? <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text> : null}
      <Button title="Войти" onPress={() => verify(code)} loading={busy} disabled={code.length !== 4} />
      <Pressable onPress={resend} disabled={left > 0} style={{ alignItems: 'center', padding: 8 }}>
        <Text style={{ color: left > 0 ? colors.muted : colors.primary, fontWeight: '600' }}>
          {left > 0 ? `Отправить снова через ${left} с` : 'Отправить код ещё раз'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, gap: space.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  code: {
    height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    fontSize: 30, letterSpacing: 16, textAlign: 'center', fontWeight: '800', color: colors.text,
  },
});
