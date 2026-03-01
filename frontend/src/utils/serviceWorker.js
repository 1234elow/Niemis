// Service Worker Registration and Management
// Handles offline functionality for NiEMIS

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
    ),
);

/**
 * Register the service worker
 */
export function register() {
  if ("serviceWorker" in navigator) {
    const publicUrl = new URL(
      process.env.PUBLIC_URL || "",
      window.location.href,
    );

    if (publicUrl.origin !== window.location.origin) {
      // Service worker won't work if PUBLIC_URL is on a different origin
      return;
    }

    window.addEventListener("load", () => {
      const swUrl = `${process.env.PUBLIC_URL}/sw.js`;

      if (isLocalhost) {
        // This is running on localhost
        checkValidServiceWorker(swUrl);

        // Add logging for localhost
        navigator.serviceWorker.ready.then(() => {
          console.log("Service Worker: Ready for offline use");
        });
      } else {
        // Is not localhost, register service worker
        registerValidSW(swUrl);
      }
    });
  }
}

/**
 * Register valid service worker
 */
function registerValidSW(swUrl) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log("Service Worker: Registered successfully");

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // New content available, prompt user to refresh
              console.log(
                "Service Worker: New content available, refresh required",
              );

              if (import.meta.env.VITE_ENABLE_NOTIFICATIONS === "true") {
                showUpdateNotification();
              }
            } else {
              // Content is cached for offline use
              console.log("Service Worker: Content cached for offline use");
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error("Service Worker: Registration failed:", error);
    });
}

/**
 * Check if service worker is valid
 */
function checkValidServiceWorker(swUrl) {
  fetch(swUrl, {
    headers: { "Service-Worker": "script" },
  })
    .then((response) => {
      const contentType = response.headers.get("content-type");

      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf("javascript") === -1)
      ) {
        // Service worker not found or not JavaScript
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found, proceed with registration
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      console.log(
        "Service Worker: No internet connection, app running in offline mode",
      );
    });
}

/**
 * Unregister service worker
 */
export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log("Service Worker: Unregistered");
      })
      .catch((error) => {
        console.error("Service Worker: Unregistration failed:", error);
      });
  }
}

/**
 * Show update notification to user
 */
function showUpdateNotification() {
  // Create a simple notification overlay
  const notification = document.createElement("div");
  notification.id = "sw-update-notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1976d2;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;

  notification.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Update Available</strong>
    </div>
    <div style="margin-bottom: 10px;">
      A new version of NiEMIS is available. Refresh to update.
    </div>
    <button onclick="window.location.reload()" style="
      background: white;
      color: #1976d2;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
    ">
      Refresh
    </button>
    <button onclick="this.parentElement.remove()" style="
      background: transparent;
      color: white;
      border: 1px solid white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    ">
      Later
    </button>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (document.getElementById("sw-update-notification")) {
      notification.remove();
    }
  }, 10000);
}

/**
 * Check if app is running offline
 */
export function isOffline() {
  return !navigator.onLine;
}

/**
 * Handle online/offline events
 */
export function setupOnlineOfflineHandlers() {
  window.addEventListener("online", () => {
    console.log("App: Back online");

    // Notify user that connection is restored
    if (import.meta.env.VITE_ENABLE_NOTIFICATIONS === "true") {
      showConnectionNotification("Connected", "success");
    }

    // Trigger background sync
    if (
      "serviceWorker" in navigator &&
      "sync" in window.ServiceWorkerRegistration.prototype
    ) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register("background-sync");
      });
    }
  });

  window.addEventListener("offline", () => {
    console.log("App: Gone offline");

    // Notify user that connection is lost
    if (import.meta.env.VITE_ENABLE_NOTIFICATIONS === "true") {
      showConnectionNotification("Offline", "warning");
    }
  });
}

/**
 * Show connection status notification
 */
function showConnectionNotification(status, type) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === "success" ? "#4caf50" : "#ff9800"};
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;

  notification.textContent = status;
  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

/**
 * Install prompt for PWA
 */
export function setupInstallPrompt() {
  let deferredPrompt;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Prevent the mini-infobar from appearing
    event.preventDefault();

    // Save the event for later use
    deferredPrompt = event;

    // Show install button or prompt
    if (import.meta.env.VITE_ENABLE_PWA === "true") {
      showInstallPrompt(deferredPrompt);
    }
  });

  window.addEventListener("appinstalled", () => {
    console.log("PWA: App installed successfully");
    deferredPrompt = null;
  });
}

/**
 * Show install prompt
 */
function showInstallPrompt(deferredPrompt) {
  const installPrompt = document.createElement("div");
  installPrompt.id = "pwa-install-prompt";
  installPrompt.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1976d2;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;

  installPrompt.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Install NiEMIS</strong>
    </div>
    <div style="margin-bottom: 10px;">
      Install the app for a better experience
    </div>
    <button onclick="installApp()" style="
      background: white;
      color: #1976d2;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
    ">
      Install
    </button>
    <button onclick="this.parentElement.remove()" style="
      background: transparent;
      color: white;
      border: 1px solid white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    ">
      Not Now
    </button>
  `;

  // Add install function to window
  window.installApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();

      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("PWA: User accepted the install prompt");
        } else {
          console.log("PWA: User dismissed the install prompt");
        }
        deferredPrompt = null;
      });
    }

    installPrompt.remove();
  };

  document.body.appendChild(installPrompt);

  // Auto-remove after 15 seconds
  setTimeout(() => {
    if (document.getElementById("pwa-install-prompt")) {
      installPrompt.remove();
    }
  }, 15000);
}

/**
 * Initialize service worker and PWA features
 */
export function initializeServiceWorker() {
  if (import.meta.env.VITE_ENABLE_OFFLINE_MODE === "true") {
    register();
    setupOnlineOfflineHandlers();
  }

  if (import.meta.env.VITE_ENABLE_PWA === "true") {
    setupInstallPrompt();
  }

  console.log("Service Worker: Initialized");
}
