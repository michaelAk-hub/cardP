import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL } from '../config';

// Opens the Google Wallet "Save" page in the browser.
export async function openGoogleWallet(
  request: <T>(path: string) => Promise<T>,
): Promise<void> {
  const { saveUrl } = await request<{ saveUrl: string }>('/student/wallet/google');
  await WebBrowser.openBrowserAsync(saveUrl);
}

// Downloads the signed .pkpass (with auth) and hands it to the OS, which shows
// the "Add to Apple Wallet" sheet on iOS.
export async function addAppleWallet(accessToken: string): Promise<void> {
  const target = `${FileSystem.cacheDirectory}bluecard.pkpass`;
  const res = await FileSystem.downloadAsync(`${API_URL}/student/wallet/apple`, target, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(res.uri, {
      mimeType: 'application/vnd.apple.pkpass',
      UTI: 'com.apple.pkpass',
    });
  }
}
