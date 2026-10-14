export interface HudTarget {
  name: string;
  distanceKm: number;
  status: string;
}

export interface HudData {
  speedKmS: number;
  referenceName: string;
  parked: boolean; // circling the reference body in a parking orbit
  flightAssist: boolean;
  cruise: boolean;
  navLock: boolean;
  cruiseArmed: string | null; // what armed cruise is waiting for, e.g. 'clear 9,000 km'
  cruiseCapKmS: number;
  target: HudTarget | null;
  scanProgress: number | null; // 0..1 while a scan is in progress, else null
  codexCount: number;
  codexTotal: number;
}

const SCAN_RING_CIRCUMFERENCE = 2 * Math.PI * 26; // matches the SVG circle's r

// Flight heads-up display. Text is only written when it changes, since
// update() runs every frame.
export default class Hud {
  private _speed = byId('hud-speed');
  private _frame = byId('hud-frame');
  private _assist = byId('hud-assist');
  private _drive = byId('hud-drive');
  private _target = byId('hud-target');
  private _targetName = byId('hud-target-name');
  private _targetDistance = byId('hud-target-distance');
  private _targetStatus = byId('hud-target-status');
  private _codex = byId('hud-codex');
  private _scanRing = document.getElementById('hud-scan-ring') as unknown as SVGCircleElement;
  private _message = byId('hud-message');
  private _messageTimer: number | undefined;

  constructor() {
    this._scanRing.style.strokeDasharray = String(SCAN_RING_CIRCUMFERENCE);
  }

  update(data: HudData): void {
    setText(this._speed, `${formatNumber(data.speedKmS)} km/s`);
    setText(this._frame, data.parked ? `Orbiting ${data.referenceName}` : `rel. ${data.referenceName}`);
    setText(this._assist, data.flightAssist ? 'Assist ON' : 'Assist OFF');
    this._assist.classList.toggle('warn', !data.flightAssist);
    const drive = data.navLock ? 'Cruise · NAV LOCK' : `Cruise · cap ${formatNumber(data.cruiseCapKmS)} km/s`;
    const armed = data.cruiseArmed !== null ? `Cruise armed · ${data.cruiseArmed}` : 'Thrusters';
    setText(this._drive, data.cruise ? drive : armed);
    this._drive.classList.toggle('active', data.cruise || data.cruiseArmed !== null);

    this._target.classList.toggle('hidden', !data.target);
    if (data.target) {
      setText(this._targetName, data.target.name);
      setText(this._targetDistance, `${formatNumber(data.target.distanceKm)} km`);
      setText(this._targetStatus, data.target.status);
    }

    setText(this._codex, `Codex ${data.codexCount} / ${data.codexTotal}`);

    const scanning = data.scanProgress !== null;
    this._scanRing.classList.toggle('hidden', !scanning);
    if (scanning) {
      this._scanRing.style.strokeDashoffset = String(SCAN_RING_CIRCUMFERENCE * (1 - data.scanProgress!));
    }
  }

  flash(message: string, durationMs = 2500): void {
    this._message.textContent = message;
    this._message.classList.add('visible');
    window.clearTimeout(this._messageTimer);
    this._messageTimer = window.setTimeout(() => this._message.classList.remove('visible'), durationMs);
  }
}

function byId(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
