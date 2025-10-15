import { Stack, ErrorBoundary } from "expo-router";
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


// Optionally ignore specific warnings during development
LogBox.ignoreAllLogs(false);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="contact-detail" options={{ headerShown: false }} />
        <Stack.Screen name="graph-view" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
