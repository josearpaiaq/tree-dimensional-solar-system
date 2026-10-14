import { orderByParent, type default as CelestialBody } from '../bodies/CelestialBody.ts';

export const SHIP_ENTRY_ID = 'ship';

export interface NavListOptions {
  onSelect?: (bodyId: string) => void;
  onSelectShip?: () => void; // adds a "Your ship" entry at the top
}

// List of every body name, shown in map mode — the deliberate "lost user"
// affordance, since free orbit has no other guaranteed way back to a
// specific body. Both this and raycaster clicks call the same
// onSelect(bodyId), so there is one source of truth for "focus this body".
export default class NavList {
  container: HTMLElement;
  buttons: Map<string, HTMLButtonElement>;

  constructor(bodies: CelestialBody[], { onSelect, onSelectShip }: NavListOptions = {}) {
    this.container = document.getElementById('nav-list')!;
    this.buttons = new Map();

    if (onSelectShip) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-ship';
      button.textContent = 'Your ship';
      button.addEventListener('click', () => onSelectShip());
      this.container.appendChild(button);
      this.buttons.set(SHIP_ENTRY_ID, button);
    }

    for (const body of orderByParent(bodies)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = body.name;
      if (body.type === 'moon') button.classList.add('moon');
      button.addEventListener('click', () => onSelect?.(body.id));
      this.container.appendChild(button);
      this.buttons.set(body.id, button);
    }
  }

  setActive(bodyId: string | null): void {
    for (const [id, button] of this.buttons) {
      button.classList.toggle('active', id === bodyId);
    }
  }
}
