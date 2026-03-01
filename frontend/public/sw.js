// NiEMIS Service Worker
// Provides offline functionality and caching for the education management system

const CACHE_NAME = 'niemis-v1.0.0';
const STATIC_CACHE_NAME = 'niemis-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'niemis-dynamic-v1.0.0';

// Resources to cache immediately
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/static/js/vendor.js',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico'
];

// API endpoints to cache for offline access
const CACHE_API_ENDPOINTS = [
  '/api/auth/profile',
  '/api/schools',
  '/api/students/profile'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('Service Worker: Static resources cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static resources:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with caching strategy
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (requestUrl.origin !== location.origin) {
    return;
  }
  
  // Handle API requests
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // Handle static resources
  if (requestUrl.pathname.startsWith('/static/')) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }
  
  // Handle navigation requests (SPA routing)
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }
  
  // Default handling for other requests
  event.respondWith(handleDefaultRequest(event.request));
});

// Handle API requests - Network first, cache fallback
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const cacheKey = url.pathname + url.search;
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses for specific endpoints
      if (CACHE_API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        cache.put(cacheKey, response.clone());
      }
      return response;
    }
    
    // If network fails, try cache
    const cachedResponse = await caches.match(cacheKey);
    if (cachedResponse) {
      console.log('Service Worker: Serving API response from cache:', cacheKey);
      return cachedResponse;
    }
    
    // Return error response if no cache available
    return new Response(
      JSON.stringify({ error: 'Network error and no cached data available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Service Worker: API request failed:', error);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(cacheKey);
    if (cachedResponse) {
      console.log('Service Worker: Serving API response from cache:', cacheKey);
      return cachedResponse;
    }
    
    // Return offline response
    return new Response(
      JSON.stringify({ error: 'Offline - please check your connection' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static resources - Cache first, network fallback
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('Service Worker: Static resource request failed:', error);
    
    // Return a basic offline response for static resources
    return new Response('Resource not available offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle navigation requests - Cache first, network fallback
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    console.log('Service Worker: Navigation request failed, serving from cache');
  }
  
  // Serve cached index.html for SPA routing
  const cachedResponse = await caches.match('/index.html');
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return offline page
  return new Response(
    `<!DOCTYPE html>
    <html>
    <head>
      <title>NiEMIS - Offline</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .offline-message { color: #666; }
      </style>
    </head>
    <body>
      <h1>NiEMIS</h1>
      <div class="offline-message">
        <h2>You are offline</h2>
        <p>Please check your internet connection and try again.</p>
        <button onclick="window.location.reload()">Retry</button>
      </div>
    </body>
    </html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    }
  );
}

// Handle default requests
async function handleDefaultRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.error('Service Worker: Default request failed:', error);
    return new Response('Request failed', { status: 503 });
  }
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Service Worker: Performing background sync');
  
  // Sync any pending offline actions
  // This would typically involve reading from IndexedDB and sending pending requests
  
  try {
    // Example: Sync attendance records
    const pendingActions = await getStoredActions();
    
    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        if (response.ok) {
          await removeStoredAction(action.id);
          console.log('Service Worker: Synced action:', action.id);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync action:', action.id, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Helper functions for offline storage
async function getStoredActions() {
  // In a real implementation, this would read from IndexedDB
  return [];
}

async function removeStoredAction(actionId) {
  // In a real implementation, this would remove from IndexedDB
  console.log('Service Worker: Removing stored action:', actionId);
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'niemis-notification',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Details'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Service Worker: Loaded successfully');