import UIKit
import React

// Owns the window and starts React Native, now that this SDK requires real
// UIScene adoption (see Info.plist's UIApplicationSceneManifest) — AppDelegate
// only builds the React Native factory; this is where it's actually used.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(withModuleName: "YTCFronend", in: window, launchOptions: nil)

    window.makeKeyAndVisible()
  }
}
