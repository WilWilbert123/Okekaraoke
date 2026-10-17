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
    // If primary domain fails (DNS error, host not found, network failure)
    if (currentUrl === PRIMARY_URL) {
      handleDomainFailure();
    }
  };

  const handleHttpError = (event: WebViewHttpErrorEvent) => {
    const { nativeEvent } = event;
    // If primary domain returns 404/502/503 (e.g. expired domain or parking page)
    if (currentUrl === PRIMARY_URL && (nativeEvent.statusCode >= 500 || nativeEvent.statusCode === 404)) {
      console.warn('[WebView HTTP Error]', nativeEvent.statusCode);
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
    }, 1000);
  };

  const renderErrorScreen = () => {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(45, 212, 191, 0.18)', 'transparent']}
            style={styles.gradientHeader}
          />

          <View style={styles.iconContainer}>
            <Ionicons name="wifi-outline" size={44} color="#2dd4bf" />
            <View style={styles.alertBadge}>
              <Ionicons name="alert" size={14} color="#ef4444" />
            </View>
          </View>

          <Text style={styles.errorTitle}>No Internet Connection</Text>
          <Text style={styles.errorSubtitle}>
            OkeKaraoke requires an active connection to load songs and sync rooms. Please check your Wi-Fi or mobile data.
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.8}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="refresh-outline" size={18} color="#000000" style={styles.buttonIcon} />
                <Text style={styles.retryButtonText}>Retry Connection</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          OKEKARAOKE MOBILE {currentUrl === FALLBACK_URL ? '(BACKUP SERVER)' : ''}
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
    borderColor: '#ef4444',
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
    marginBottom: 24,
  },
  retryButton: {
    width: '100%',
    height: 46,
    backgroundColor: '#2dd4bf',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  footerText: {
    marginTop: 24,
    fontSize: 10,
    fontWeight: '700',
    color: '#52525b',
    letterSpacing: 1.5,
  },
});
