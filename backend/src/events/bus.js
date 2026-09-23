import { EventEmitter } from 'node:events';

/**
 * EventBus — abstraksi message broker (Event-Driven Architecture).
 *
 * Di produksi, lapisan ini dapat diganti dengan RabbitMQ/Kafka tanpa mengubah
 * kode modul: publisher cukup memanggil `bus.publish(topic, payload)` dan
 * worker berlangganan melalui `bus.subscribe(topic, handler)`.
 *
 * Seluruh job diproses asynchronous (di luar request cycle) sehingga
 * latensi API tetap rendah — sesuai target performa < 2 detik.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.history = []; // jejak event untuk debugging/demo
  }

  publish(topic, payload = {}) {
    const event = { topic, payload, at: new Date().toISOString() };
    this.history.push(event);
    if (this.history.length > 200) this.history.shift();
    // async: handler dieksekusi di luar stack request
    setImmediate(() => this.emit(topic, payload));
    return event;
  }

  subscribe(topic, handler) {
    this.on(topic, (payload) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[bus] worker error on "${topic}":`, err.message);
      }
    });
  }
}

export const bus = new EventBus();

// Topik-topik event sistem
export const TOPICS = {
  BILL_ISSUED: 'bill.issued',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_VERIFIED: 'payment.verified',
  GUEST_CHECKIN: 'guest.checkin',
  GUEST_CHECKOUT: 'guest.checkout',
  COMPLAINT_CREATED: 'complaint.created',
  COMPLAINT_UPDATED: 'complaint.updated',
  ANNOUNCEMENT_PUBLISHED: 'announcement.published',
  FINANCE_PUBLISHED: 'finance.published',
};
