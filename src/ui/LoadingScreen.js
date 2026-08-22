// Driven by the shared THREE.LoadingManager so the app's first reveal is
// gated on every texture being ready — no pop-in.
export default class LoadingScreen {
  constructor(loadingManager, { onLoad } = {}) {
    this.el = document.getElementById('loading-screen');
    this.label = document.getElementById('loading-label');
    this.fill = document.getElementById('loading-bar-fill');

    loadingManager.onProgress = (_url, loaded, total) => {
      const pct = total > 0 ? Math.round((loaded / total) * 100) : 100;
      this.fill.style.width = `${pct}%`;
    };

    loadingManager.onLoad = () => {
      this.fill.style.width = '100%';
      onLoad?.();
    };

    loadingManager.onError = (url) => {
      this.label.textContent = `Failed to load ${url}`;
    };
  }

  hide() {
    this.el.classList.add('hidden');
  }
}
