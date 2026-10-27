// Minimal compatibility shims so the app runs on Android System WebView 55+
// (Chrome 55, the oldest version Capacitor 8 accepts). Each shim only fills a
// gap between WebView 55 and the version where the native API appeared.

// ResizeObserver: native from WebView 64. This fallback watches the observed
// element's box on window resize and each animation frame, which is precise
// enough for the single use here: keeping the drawing canvas fitted to its host.
if (typeof ResizeObserver === 'undefined') {
  type Entry = { target: Element; contentRect: DOMRect };
  class ShallowResizeObserver {
    private targets = new Map<Element, { width: number; height: number }>();
    private frame = 0;
    constructor(private callback: (entries: Entry[]) => void) {}
    private tick = () => {
      const changed: Entry[] = [];
      for (const [target, size] of this.targets) {
        const rect = target.getBoundingClientRect();
        const width = Math.max(0, rect.width),
          height = Math.max(0, rect.height);
        if (width !== size.width || height !== size.height) {
          this.targets.set(target, { width, height });
          changed.push({ target, contentRect: rect });
        }
      }
      if (changed.length) this.callback(changed);
      if (this.targets.size) this.frame = requestAnimationFrame(this.tick);
      else this.frame = 0;
    };
    private run() {
      if (!this.frame) this.frame = requestAnimationFrame(this.tick);
    }
    observe(target: Element) {
      const rect = target.getBoundingClientRect();
      this.targets.set(target, { width: rect.width, height: rect.height });
      this.run();
    }
    unobserve(target: Element) {
      this.targets.delete(target);
      if (!this.targets.size && this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    }
    disconnect() {
      this.targets.clear();
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    }
  }
  (window as { ResizeObserver?: unknown }).ResizeObserver = ShallowResizeObserver;
}
