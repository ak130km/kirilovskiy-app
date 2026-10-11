import type { CustomerDto } from '@kirilovskiy/shared';
import { formatPhone } from '@kirilovskiy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '@/api/client';
import { useStoreInfo } from '@/api/hooks';
import { Button, Card, Field, Notice } from '@/components/ui';
import { getPushPermission, PushState, registerForPush } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { colors, font, radius, space } from '@/theme';

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export default function ProfileScreen() {
  const token = useSession((s) => s.token);
  const customer = useSession((s) => s.customer);
  const setCustomer = useSession((s) => s.setCustomer);
  const signOut = useSession((s) => s.signOut);
  const forgetEverything = useSession((s) => s.forgetEverything);
  const queryClient = useQueryClient();
  const store = useStoreInfo();
  const [name, setName] = useState(customer?.name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [push, setPush] = useState<PushState>('unavailable');

  useFocusEffect(
    useCallback(() => {
      void getPushPermission().then(setPush);
      if (token) {
        api.get<CustomerDto>('/me').then((c) => { setCustomer(c); setName(c.name ?? ''); setEmail(c.email ?? ''); }).catch(() => undefined);
      }
    }, [token, setCustomer]),
  );

  useEffect(() => {
    setName(customer?.name ?? '');
    setEmail(customer?.email ?? '');
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      setCustomer(await api.patch<CustomerDto>('/me', { name: name.trim() || undefined, email: email.trim() || null }));
      notify('Сохранено');
    } catch (e) {
      notify('Не сохранилось', errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await signOut();
    void registerForPush(false); // устройство остаётся гостевым
    void queryClient.invalidateQueries();
  }

  function deleteAccount() {
    confirm(
      'Удалить аккаунт?',
      'Мы удалим ваш профиль, телефон, адреса и привязку устройств. История заказов на этом устройстве тоже будет очищена. Действие нельзя отменить.',
      'Удалить навсегда',
      async () => {
        setDeleting(true);
        try {
          await api.delete('/me');
          await forgetEverything();
          void queryClient.invalidateQueries();
          notify('Аккаунт удалён', 'Ваши персональные данные удалены. Оформлять заказы можно и без аккаунта.');
        } catch (e) {
          notify('Не удалось удалить аккаунт', errorText(e));
        } finally {
          setDeleting(false);
        }
      },
    );
  }

  async function enablePush() {
    if (push === 'denied') {
      void Linking.openSettings();
      return;
    }
    await registerForPush(true);
    setPush(await getPushPermission());
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {token && customer ? (
        <Card style={{ gap: space.md }}>
          <View style={styles.userRow}>
            <View style={styles.avatar}><Ionicons name="person" size={26} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>{customer.name || 'Без имени'}</Text>
              <Text style={font.small}>{formatPhone(customer.phone)}</Text>
            </View>
          </View>
          <Field label="Имя" value={name} onChangeText={setName} placeholder="Как к вам обращаться" />
          <Field label="Email (для чеков)" value={email} onChangeText={setEmail} placeholder="mail@example.ru" keyboardType="email-address" autoCapitalize="none" />
          <Button title="Сохранить" variant="secondary" size="md" onPress={save} loading={saving} />
        </Card>
      ) : (
        <Card style={{ gap: space.md }}>
          <Text style={font.h2}>Вы не вошли</Text>
          <Text style={[font.body, { color: colors.muted }]}>
            Заказывать можно без регистрации. Аккаунт нужен, чтобы видеть историю заказов на всех устройствах и не вводить данные заново.
          </Text>
          <Button title="Войти по номеру телефона" icon="phone-portrait-outline" onPress={() => router.push('/auth/phone')} />
        </Card>
      )}

      <Card style={{ gap: space.md }}>
        <View style={styles.userRow}>
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={font.h3}>Уведомления о заказе</Text>
            <Text style={font.small}>
              {push === 'granted' ? 'Включены — сообщим о каждом изменении статуса' : push === 'unavailable' ? 'Недоступны на этом устройстве' : 'Выключены'}
            </Text>
          </View>
        </View>
        {push === 'undetermined' || push === 'denied' ? (
          <Button title={push === 'denied' ? 'Открыть настройки' : 'Включить уведомления'} size="md" variant="secondary" onPress={enablePush} />
        ) : null}
      </Card>

      {store.data ? (
        <Card style={{ gap: 10 }}>
          <Text style={font.h3}>{store.data.name}</Text>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL(`tel:${store.data!.phone.replace(/[^\d+]/g, '')}`)}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={font.body}>{store.data.phone}</Text>
          </Pressable>
          <View style={styles.linkRow}>
            <Ionicons name="storefront-outline" size={20} color={colors.primary} />
            <Text style={[font.body, { flex: 1 }]}>{store.data.pickupAddress}</Text>
          </View>
          <View style={styles.linkRow}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={font.body}>{store.data.pickupHours}</Text>
          </View>
          {store.data.privacyPolicyUrl ? (
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL(store.data!.privacyPolicyUrl)}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={[font.body, { color: colors.primary }]}>Политика конфиденциальности</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {token ? (
        <View style={{ gap: space.sm }}>
          <Button title="Выйти" variant="secondary" icon="log-out-outline" onPress={logout} />
          <Button title="Удалить аккаунт" variant="danger" icon="trash-outline" onPress={deleteAccount} loading={deleting} />
          <Notice tone="info" text="Удаление аккаунта стирает персональные данные. Если у вас есть заказ в работе, удалить аккаунт можно после его выполнения." />
        </View>
      ) : null}

      <Text style={styles.version}>Версия {Constants.expoConfig?.version ?? '—'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xxl, maxWidth: 720, width: '100%', alignSelf: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: space.md },
  card: { borderRadius: radius.lg },
});
