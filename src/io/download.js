export function safeFilename(title) {
  return title.normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 65) || 'cylinder';
}

/** Own object URLs so hot reload / teardown does not leave resources behind. */
export class Downloads {
  constructor() {
    this.pending = new Map();
    this.disposed = false;
  }

  save(data, filename, type) {
    if (this.disposed) return;
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      this.pending.delete(url);
    }, 60000);
    this.pending.set(url, timer);
  }

  dispose() {
    this.disposed = true;
    for (const [url, timer] of this.pending) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    this.pending.clear();
  }
}
