// Always-visible list of the 9 body names — the deliberate "lost user"
// affordance, since free orbit has no other guaranteed way back to a
// specific planet. Both this and raycaster clicks call the same
// onSelect(bodyId), so there is one source of truth for "focus this body".
export default class NavList {
  constructor(bodies, { onSelect } = {}) {
    this.container = document.getElementById('nav-list');
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

  setActive(bodyId) {
    for (const [id, button] of this.buttons) {
      button.classList.toggle('active', id === bodyId);
    }
  }
}
