/** Toast presentation and the single error boundary for asynchronous UI actions. */
export class Notifications {
  constructor(element) {
    this.element = element;
    this.timer = null;
    this.disposed = false;
  }

  show(message, error = false, duration = 5500) {
    if (this.disposed) return;
    this.element.textContent = message;
    this.element.classList.toggle('error', error);
    this.element.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.element.classList.remove('show'), duration);
  }

  guard(action) {
    return async (...args) => {
      if (this.disposed) return;
      try {
        return await action(...args);
      } catch (error) {
        console.error(error);
        this.show(error.message || String(error), true, 12000);
      }
    };
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.element.classList.remove('show');
  }
}
