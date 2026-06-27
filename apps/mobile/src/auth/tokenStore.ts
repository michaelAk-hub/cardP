import * as SecureStore from 'expo-secure-store';
import { TokenPair } from '../api/types';

const KEY = 'bluecard.session';

// Persists the token pair in the device secure store (Keychain / Keystore).
export const tokenStore = {
  async save(tokens: TokenPair): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  },
  async load(): Promise<TokenPair | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenPair;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  },
};
