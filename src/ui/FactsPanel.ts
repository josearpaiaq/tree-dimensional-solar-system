import type CelestialBody from '../bodies/CelestialBody.ts';

export interface FactsPanelOptions {
  onClose?: () => void;
}

// Fades in/out in sync with camera fly-to arrival/departure (driven by
// main.ts via show()/hide()) so it never shows stale content mid-flight.
export default class FactsPanel {
  panel: HTMLElement;
  nameEl: HTMLElement;
  statsEl: HTMLElement;
  closeButton: HTMLButtonElement;

  constructor({ onClose }: FactsPanelOptions = {}) {
    this.panel = document.getElementById('facts-panel')!;
    this.nameEl = document.getElementById('facts-panel-name')!;
    this.statsEl = document.getElementById('facts-panel-stats')!;
    this.closeButton = document.getElementById('facts-panel-close') as HTMLButtonElement;
    this.closeButton.addEventListener('click', () => onClose?.());
  }

  show(body: CelestialBody): void {
    this.nameEl.textContent = body.name;
    this.statsEl.innerHTML = '';

    const rows: [string, string][] = [
      ['Diameter', formatKm(body.facts.diameterKm)],
      ['Distance from Sun', body.facts.distanceFromSunKm > 0 ? formatKm(body.facts.distanceFromSunKm) : '—'],
      ['Day length', formatHours(body.facts.dayLengthHours)],
      ['Moons', String(body.facts.moons)],
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      this.statsEl.append(dt, dd);
    }

    this.panel.classList.add('visible');
  }

  hide(): void {
    this.panel.classList.remove('visible');
  }
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function formatHours(hours: number): string {
  if (hours >= 48) {
    return `${(hours / 24).toLocaleString('en-US', { maximumFractionDigits: 1 })} days`;
  }
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hours`;
}
