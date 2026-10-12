import type CelestialBody from '../bodies/CelestialBody.ts';

export interface NavListOptions {
  onSelect?: (bodyId: string) => void;
}

// Always-visible list of the 9 body names — the deliberate "lost user"
// affordance, since free orbit has no other guaranteed way back to a
// specific planet. Both this and raycaster clicks call the same
// onSelect(bodyId), so there is one source of truth for "focus this body".
export default class NavList {
  container: HTMLElement;
  buttons: Map<string, HTMLButtonElement>;

  constructor(bodies: CelestialBody[], { onSelect }: NavListOptions = {}) {
    this.container = document.getElementById('nav-list')!;
    this.buttons = new Map();

    for (const body of bodies) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = body.name;
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
