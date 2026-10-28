import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Push notifications (Firebase) — FirebaseApp.configure() hard-crashes
    // (fatalError) if GoogleService-Info.plist isn't in the bundle, so this
    // only runs once that file's actually been added via Xcode (see
    // README.md). Must come before React Native starts, same as this whole
    // method already does for the factory below.
    if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      FirebaseApp.configure()
    }

    // Scene lifecycle is mandatory on this SDK (see Info.plist's
    // UIApplicationSceneManifest): the window and the React Native factory's
    // startReactNative call now happen in SceneDelegate, once UIKit actually
    // connects a scene, not here. This method only builds the factory itself,
    // which SceneDelegate reaches via `UIApplication.shared.delegate`.
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
