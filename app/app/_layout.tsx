import { Stack, ErrorBoundary } from "expo-router";
import { LogBox } from 'react-native';


// Optionally ignore specific warnings during development
LogBox.ignoreAllLogs(false);

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="contact-detail" options={{ headerShown: false }} />
    </Stack>
  );
}
