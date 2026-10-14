import type CelestialBody from '../bodies/CelestialBody.ts';

const TYPE_LABELS: Record<CelestialBody['type'], string> = { star: 'Star', planet: 'Planet', moon: 'Moon' };

export interface ShowOptions {
  cataloged?: boolean;
  closeLabel?: string;
}

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

  // Uncataloged bodies only reveal what a pilot could see from afar; the
  // facts are the reward for scanning.
  show(body: CelestialBody, { cataloged = true, closeLabel = '← Overview' }: ShowOptions = {}): void {
    this.nameEl.textContent = body.name;
    this.closeButton.textContent = closeLabel;
    this.statsEl.innerHTML = '';

    const facts = body.facts;
    let rows: [string, string][];
    if (!cataloged) {
      rows = [
        ['Type', TYPE_LABELS[body.type]],
        ...(body.parent && body.type === 'moon' ? [['Orbits', body.parent.name] as [string, string]] : []),
        ['Status', 'Unscanned'],
      ];
    } else if ('distanceFromParentKm' in facts) {
      rows = [
        ['Diameter', formatKm(facts.diameterKm)],
        ['Orbits', body.parent?.name ?? '—'],
        ['Distance from ' + (body.parent?.name ?? 'parent'), formatKm(facts.distanceFromParentKm)],
        ['Orbital period', formatHours(facts.orbitalPeriodDays * 24)],
      ];
    } else {
      rows = [
        ['Diameter', formatKm(facts.diameterKm)],
        ['Distance from Sun', facts.distanceFromSunKm > 0 ? formatKm(facts.distanceFromSunKm) : '—'],
        ['Day length', formatHours(facts.dayLengthHours)],
        ['Moons', String(facts.moons)],
      ];
    }
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
