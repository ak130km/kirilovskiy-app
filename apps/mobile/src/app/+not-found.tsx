import { router, Stack } from 'expo-router';
import { Button, EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Не найдено' }} />
      <EmptyState
        icon="help-circle-outline"
        title="Страница не найдена"
        action={<Button title="На главную" size="md" onPress={() => router.replace('/')} />}
      />
    </>
  );
}
