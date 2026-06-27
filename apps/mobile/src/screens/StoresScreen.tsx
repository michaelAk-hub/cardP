import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loading, ErrorState } from '../components/Screen';
import { StoreCard } from '../components/cards';
import { useAuth } from '../auth/AuthContext';
import { Store } from '../api/types';
import { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

export function StoresScreen() {
  const { t, i18n } = useTranslation();
  const { request } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [stores, setStores] = useState<Store[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      request<Store[]>('/stores')
        .then((data) => active && setStores(data))
        .catch((e) => active && setError((e as Error).message));
      return () => {
        active = false;
      };
    }, [request]),
  );

  const filtered = useMemo(() => {
    if (!stores) return [];
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      `${s.nameEn} ${s.nameEl}`.toLowerCase().includes(q),
    );
  }, [stores, query]);

  if (error) return <ErrorState message={error} />;
  if (!stores) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder={t('stores.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  search: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 44,
    color: colors.text,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
