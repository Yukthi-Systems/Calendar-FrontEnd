import { useAtomValue } from 'jotai';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ssoLoginRequestAtom } from '../atoms/ssoLogin';
import { settleSsoLogin } from '../services/ssoLoginRequest';
import { useAccentColor } from '../hooks/useAccentColor';

// The SSO login page in `mode=popup` reports back via window.opener.postMessage and
// then calls window.close(). A WebView has no opener, so provide one that forwards
// to React Native. With no `origin` query param the page targets '*', so no SSO
// allow-list change is needed. Runs before the page's own scripts on every load.
const OPENER_SHIM = `(function () {
  var forward = function (msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  var opener = { postMessage: forward, closed: false };
  try {
    Object.defineProperty(window, 'opener', { get: function () { return opener; }, configurable: true });
  } catch (e) {
    window.opener = opener;
  }
  window.close = function () {};
})();
true;`;

// Mounted once at the app root; shows itself whenever sso.native.ts requests a login.
export function SsoLoginModal() {
  const request = useAtomValue(ssoLoginRequestAtom);
  const accent = useAccentColor();

  const cancel = () =>
    settleSsoLogin({
      ok: false,
      error: new Error('SSO sign-in was cancelled'),
    });

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: { type?: string; payload?: unknown; message?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'SSO_AUTH_SUCCESS') {
      settleSsoLogin({ ok: true, payload: msg.payload ?? msg });
    } else if (
      msg.type === 'SSO_AUTH_FAILED' ||
      msg.type === 'SSO_SESSION_EXPIRED'
    ) {
      settleSsoLogin({
        ok: false,
        error: new Error(msg.message || 'SSO sign-in failed'),
      });
    }
  };

  return (
    <Modal
      visible={!!request}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cancel}
    >
      <SafeAreaView className="flex-1 bg-bg-main">
        <View className="flex-row items-center justify-between border-b border-border-main px-4 py-3">
          <Text className="text-base font-semibold text-text-heading">
            Yukthi SSO
          </Text>
          <Pressable accessibilityRole="button" onPress={cancel} hitSlop={12}>
            <Text className="text-base text-accent">Cancel</Text>
          </Pressable>
        </View>
        {request && (
          <WebView
            source={{ uri: request.url }}
            injectedJavaScriptBeforeContentLoaded={OPENER_SHIM}
            onMessage={onMessage}
            // Keep cookies persistent and shared with fetch where the platform allows.
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            incognito={false}
            startInLoadingState
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator color={accent} size="large" />
              </View>
            )}
            onError={e =>
              settleSsoLogin({
                ok: false,
                error: new Error(
                  e.nativeEvent.description ||
                    'Could not reach the SSO service',
                ),
              })
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
