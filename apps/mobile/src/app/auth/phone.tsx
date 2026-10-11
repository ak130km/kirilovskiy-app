import type { OtpRequestResponse } from '@kirilovskiy/shared';
import { maskPhoneInput, normalizePhone } from '@kirilovskiy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '@/api/client';
import { Button, Field } from '@/components/ui';
import { useSession } from '@/store/session';
import { colors, font, space } from '@/theme';

export default function PhoneScreen() {
  const saved = useSession((s) => s.checkout.customerPhone);
  const [phone, setPhone] = useState(maskPhoneInput(saved ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Номер в формате +7 9XX XXX-XX-XX');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<OtpRequestResponse>('/auth/otp/request', { phone: normalized }, { anonymous: true });
      router.push({ pathname: '/auth/code', params: { phone: normalized, devCode: res.devCode ?? '' } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={font.title}>Вход по номеру</Text>
        <Text style={[font.body, { color: colors.muted }]}>Пришлём SMS с кодом. Если аккаунта ещё нет — создадим автоматически.</Text>
        <Field label="Телефон" value={phone} onChangeText={(v) => setPhone(maskPhoneInput(v))} keyboardType="phone-pad" autoFocus placeholder="+7 900 000-00-00" error={error} autoComplete="tel" onSubmitEditing={submit} />
        <Button title="Получить код" onPress={submit} loading={busy} />
        <Text style={styles.legal}>Продолжая, вы соглашаетесь на обработку персональных данных.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, gap: space.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  legal: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
