importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAtHW7UW3-ftQq9loSHPJkkbSeDSONI2KE",
  authDomain: "qasimflix-8ba04.firebaseapp.com",
  projectId: "qasimflix-8ba04",
  storageBucket: "qasimflix-8ba04.firebasestorage.app",
  messagingSenderId: "958468258867",
  appId: "1:958468258867:web:08395af3f9a39f9fcf3746"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'QasimFlix';
  const options = {
    body: payload.notification?.body || 'Yeni içerik eklendi',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-96.png',
    data: {
      url: payload.data?.url || '/'
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
