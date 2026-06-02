/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA8LJ07TpuHhMt5Sasy0RYr4LgcyaMCkzw",
  authDomain: "game-day-app-115a4.firebaseapp.com",
  projectId: "game-day-app-115a4",
  storageBucket: "game-day-app-115a4.firebasestorage.app",
  messagingSenderId: "426784645463",
  appId: "1:426784645463:web:909f022666b832a046de12"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const notificationTitle = title || 'Vaulte';
  const notificationOptions = {
    body: body || '',
    icon: icon || '/vaulte-icon.png',
    badge: '/vaulte-icon.png',
    data: payload.data,
    vibrate: [200, 100, 200],
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
