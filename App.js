import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import UpdatePrompt from './src/components/UpdatePrompt';

function RootApp() {
  const { themeMode, isLoading } = useAuth();
  return (
    <>
      <StatusBar style={themeMode === 'LIGHT' ? 'dark' : 'light'} />
      <AppNavigator />
      <UpdatePrompt enabled={!isLoading} themeMode={themeMode} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
