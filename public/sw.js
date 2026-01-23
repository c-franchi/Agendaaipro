// Sistema desenvolvido por Dev Nei
// Service Worker para cache offline e notificações
const CACHE_NAME = 'barber-on-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css'
];

// Instalação: armazena recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Estratégia de cache: responde do cache e busca na rede como fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Limpa caches antigos ao ativar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Notificações push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Você tem um novo agendamento',
    icon: 'https://storage.googleapis.com/gpt-engineer-file-uploads/PHfEygLl96PVOoKNyvcTx1Nu69z1/uploads/1759934031239-barber.png',
    badge: 'https://storage.googleapis.com/gpt-engineer-file-uploads/PHfEygLl96PVOoKNyvcTx1Nu69z1/uploads/1759934031239-barber.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open', title: 'Ver detalhes' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Barber-On', options)
  );
});

// Clique na notificação: abre a aplicação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
