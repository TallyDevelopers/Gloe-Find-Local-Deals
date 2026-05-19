import { useAuth } from '@gloe/auth';
import { Redirect, Stack } from 'expo-router';

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'signed-in') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FBF8F3' },
      }}
    />
  );
}
