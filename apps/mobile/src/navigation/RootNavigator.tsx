import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { Loading } from '../components/Screen';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

export function RootNavigator() {
  const { booting, isAuthenticated } = useAuth();
  if (booting) return <Loading />;
  return isAuthenticated ? <AppNavigator /> : <AuthNavigator />;
}
