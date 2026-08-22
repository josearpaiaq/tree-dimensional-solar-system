// Fades in/out in sync with camera fly-to arrival/departure (driven by
// main.js via show()/hide()) so it never shows stale content mid-flight.
export default class FactsPanel {
  constructor({ onClose } = {}) {
    this.panel = document.getElementById('facts-panel');
    this.nameEl = document.getElementById('facts-panel-name');
    this.statsEl = document.getElementById('facts-panel-stats');
    this.closeButton = document.getElementById('facts-panel-close');
    this.closeButton.addEventListener('click', () => onClose?.());
  }

  show(body) {
    this.nameEl.textContent = body.name;
    this.statsEl.innerHTML = '';

    const rows = [
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

  hide() {
    this.panel.classList.remove('visible');
  }
}

function formatKm(km) {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function formatHours(hours) {
  if (hours >= 48) {
    return `${(hours / 24).toLocaleString('en-US', { maximumFractionDigits: 1 })} days`;
  }
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hours`;
}
