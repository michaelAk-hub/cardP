import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AppStackParamList } from './types';
import { AppTabs } from './AppTabs';
import { StoreDetailScreen } from '../screens/StoreDetailScreen';
import { VerifyPhoneScreen } from '../screens/VerifyPhoneScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="StoreDetail"
        component={StoreDetailScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="VerifyPhone"
        component={VerifyPhoneScreen}
        options={{ title: t('verify.title') }}
      />
    </Stack.Navigator>
  );
}
