import { orderByParent, type default as CelestialBody } from '../bodies/CelestialBody.ts';
import type Codex from '../game/Codex.ts';

export interface CodexPanelOptions {
  onSelect?: (bodyId: string) => void;
  onClose?: () => void;
}

// Logbook of every body, grouped by parent. Cataloged entries open their
// facts; uncataloged ones only hint at where to look.
export default class CodexPanel {
  panel: HTMLElement;
  private _list: HTMLElement;
  private _count: HTMLElement;
  private _bodies: CelestialBody[];
  private _onSelect: (bodyId: string) => void;

  constructor(bodies: CelestialBody[], { onSelect, onClose }: CodexPanelOptions = {}) {
    this.panel = document.getElementById('codex-panel')!;
    this._list = document.getElementById('codex-list')!;
    this._count = document.getElementById('codex-count')!;
    this._bodies = orderByParent(bodies);
    this._onSelect = onSelect ?? (() => {});
    document.getElementById('codex-close')!.addEventListener('click', () => onClose?.());
  }

  render(codex: Codex): void {
    this._list.innerHTML = '';
    this._count.textContent = `${codex.size} / ${this._bodies.length} cataloged`;
    for (const body of this._bodies) {
      const cataloged = codex.has(body.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `codex-entry ${body.type}${cataloged ? ' cataloged' : ''}`;
      button.disabled = !cataloged;

      const name = document.createElement('span');
      name.textContent = cataloged ? body.name : '???';
      const hint = document.createElement('span');
      hint.className = 'codex-hint';
      hint.textContent = body.type === 'moon' ? `Moon of ${body.parent?.name}` : body.type === 'star' ? 'Star' : 'Planet';
      button.append(name, hint);

      if (cataloged) button.addEventListener('click', () => this._onSelect(body.id));
      this._list.appendChild(button);
    }
  }
}
