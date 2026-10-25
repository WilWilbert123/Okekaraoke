import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ── Domain Endpoints ───────────────────────────────────────────
// Primary custom domain with automatic fallback to Vercel if domain expires or DNS fails
const PRIMARY_URL = 'https://www.okekaraoke.sbs/';
const FALLBACK_URL = 'https://okekaraoke.vercel.app/';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>(PRIMARY_URL);
  const [isRetrying, setIsRetrying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // ── Switch to fallback if primary fails in WebView ───────────
  const handleDomainFailure = useCallback(() => {
    if (currentUrl === PRIMARY_URL) {
      console.warn('[App] Primary domain unreachable in WebView, falling back to Vercel URL:', FALLBACK_URL);
      setCurrentUrl(FALLBACK_URL);
      setReloadKey((prev) => prev + 1);
    }
  }, [currentUrl]);

  const handleWebViewError = (event: WebViewErrorEvent) => {
    const { nativeEvent } = event;
    console.warn('[WebView Error]', nativeEvent.description, nativeEvent.code);
    // If primary domain fails with DNS/host lookup error, switch to backup
    if (
      currentUrl === PRIMARY_URL &&
      (nativeEvent.code === -2 || nativeEvent.code === -6 || nativeEvent.code === -105)
    ) {
      handleDomainFailure();
    }
  };

  const handleHttpError = (event: WebViewHttpErrorEvent) => {
    const { nativeEvent } = event;
    const url = nativeEvent.url || '';
    // Only failover if the root document / main page itself returned 404 or 5xx (not background API calls)
    const isMainDoc =
      url === currentUrl ||
      url === PRIMARY_URL ||
      url === FALLBACK_URL ||
      url.endsWith('.sbs/') ||
      url.endsWith('.vercel.app/');

    if (
      isMainDoc &&
      currentUrl === PRIMARY_URL &&
      (nativeEvent.statusCode >= 500 || nativeEvent.statusCode === 404)
    ) {
      console.warn('[WebView Main HTTP Error]', nativeEvent.statusCode, url);
      handleDomainFailure();
    }
  };

  // ── Retry connection button ──────────────────────────────────
  const handleRetry = () => {
    setIsRetrying(true);
    // Reset to primary URL to try loading again
    setCurrentUrl(PRIMARY_URL);
    setReloadKey((prev) => prev + 1);
    setTimeout(() => {
      webViewRef.current?.reload();
      setIsRetrying(false);
    }, 1200);
  };

  // ── Proceed to Offline Solo Karaoke Mode ───────────────────────
  const handleProceedToOfflineMode = () => {
    const base = (currentUrl || PRIMARY_URL).replace(/\/remote\/.*$/, '').replace(/\/$/, '');
    const offlineUrl = `${base}/remote/OFFLINE`;
    console.log('[App] Proceeding to offline mode URL:', offlineUrl);
    setCurrentUrl(offlineUrl);
    setReloadKey((prev) => prev + 1);

    // Also attempt client-side navigation in case the DOM is still active
    webViewRef.current?.injectJavaScript(`
      try {
        if (window.location.pathname !== '/remote/OFFLINE') {
          window.location.href = '/remote/OFFLINE';
        } else {
          window.location.reload();
        }
      } catch (e) {}
      true;
    `);
  };

  const renderErrorScreen = () => {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(45, 212, 191, 0.22)', 'rgba(45, 212, 191, 0.03)', 'transparent']}
            style={styles.gradientHeader}
          />

          <View style={styles.iconContainer}>
            <Ionicons name="cloud-offline-outline" size={42} color="#2dd4bf" />
            <View style={styles.alertBadge}>
              <Ionicons name="musical-notes" size={13} color="#2dd4bf" />
            </View>
          </View>

          <Text style={styles.errorTitle}>You're Offline</Text>
          <Text style={styles.errorSubtitle}>
            No internet connection detected. You can proceed directly to Offline Mode to sing all your downloaded karaoke songs.
          </Text>

          {/* Primary Action: Proceed to Offline Mode */}
          <TouchableOpacity
            style={styles.primaryOfflineButton}
            onPress={handleProceedToOfflineMode}
            activeOpacity={0.85}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="musical-notes" size={18} color="#000000" style={styles.buttonIcon} />
              <Text style={styles.primaryOfflineButtonText}>Proceed to Offline Mode</Text>
              <Ionicons name="arrow-forward" size={16} color="#000000" style={styles.buttonIconRight} />
            </View>
          </TouchableOpacity>

          {/* Secondary Action: Retry Connection */}
          <TouchableOpacity
            style={styles.secondaryRetryButton}
            onPress={handleRetry}
            activeOpacity={0.8}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#2dd4bf" size="small" style={styles.buttonIcon} />
                <Text style={styles.secondaryRetryButtonText}>Reconnecting...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="refresh-outline" size={16} color="#a1a1aa" style={styles.buttonIcon} />
                <Text style={styles.secondaryRetryButtonText}>Retry Connection</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>

          OKEKARAOKE MOBILE {currentUrl === FALLBACK_URL ? '• BACKUP SERVER' : ''}
        </Text>
      </View>
    );
  };

  const renderLoadingScreen = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2dd4bf" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      <WebView
        key={`${currentUrl}-${reloadKey}`}
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        databaseEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        cacheEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 OkeKaraokeMobile/1.0"
        javaScriptCanOpenWindowsAutomatically={true}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        startInLoadingState={true}
        onError={handleWebViewError}
        onHttpError={handleHttpError}
        renderError={renderErrorScreen}
        renderLoading={renderLoadingScreen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  webview: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 99,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#18181b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  gradientHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  alertBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryOfflineButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#2dd4bf',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#2dd4bf',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryOfflineButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryRetryButton: {
    width: '100%',
    height: 42,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRetryButtonText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonIconRight: {
    marginLeft: 6,
  },
  footerText: {
    marginTop: 24,
    fontSize: 10,
    fontWeight: '700',
    color: '#52525b',
    letterSpacing: 1.5,
  },
});
