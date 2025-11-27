export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration);
        })
        .catch((error) => {
          console.error('Erro ao registrar Service Worker:', error);
        });
    });
  }
}

export function requestNotificationPermission() {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('Permissão de notificação concedida');
      }
    });
  }
}

export function showNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        icon: 'https://storage.googleapis.com/gpt-engineer-file-uploads/PHfEygLl96PVOoKNyvcTx1Nu69z1/uploads/1759934031239-barber.png',
        badge: 'https://storage.googleapis.com/gpt-engineer-file-uploads/PHfEygLl96PVOoKNyvcTx1Nu69z1/uploads/1759934031239-barber.png',
      });
    });
  }
}

export function scheduleNotification(bookingDate: string, bookingTime: string, customerName: string) {
  const [year, month, day] = bookingDate.split('-').map(Number);
  const [hour, minute] = bookingTime.split(':').map(Number);
  
  const bookingDateTime = new Date(year, month - 1, day, hour, minute);
  const reminderTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000); // 1 hora antes
  const now = new Date();
  
  if (reminderTime > now) {
    const delay = reminderTime.getTime() - now.getTime();
    setTimeout(() => {
      showNotification(
        'Lembrete de Agendamento',
        `${customerName}, seu horário é em 1 hora! ${bookingTime}`
      );
    }, delay);
  }
}

export function notifyNewBooking(customerName: string, serviceName: string, bookingDate: string, bookingTime: string) {
  showNotification(
    '🎉 Novo Agendamento!',
    `${customerName} agendou ${serviceName} para ${new Date(bookingDate).toLocaleDateString('pt-BR')} às ${bookingTime}`
  );
}
