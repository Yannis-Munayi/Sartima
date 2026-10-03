// Firebase Cloud Messaging background handler. Registered at a dedicated
// scope (/firebase-cloud-messaging-push-scope) by src/services/notifications.js
// so it coexists with vite-plugin-pwa's root-scope Workbox service worker —
// this file is intentionally NOT processed by Vite (public/ is copied as-is),
// so the config below is the same public, non-secret Firebase config already
// shipped in the main bundle (see src/services/firebase.js).

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyDpqAzziCBbi0qJ2vuqeXkUapJbhRdlR7g',
  authDomain:        'stylelab-32659.firebaseapp.com',
  projectId:         'stylelab-32659',
  storageBucket:     'stylelab-32659.firebasestorage.app',
  messagingSenderId: '871253953762',
  appId:             '1:871253953762:web:0a69ef756c852e04a2e2bb',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Sartima'
  const body  = payload.notification?.body ?? "Today's outfit is ready."
  const link  = payload.fcmOptions?.link ?? payload.data?.link ?? '/'

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    data: { link },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(link)
    })
  )
})
