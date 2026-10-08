/* Add touch/keyboard navigation without changing any existing links or data. */
(() => {
  const bar = document.querySelector('.navbar');
  const nav = bar?.querySelector('.nav');
  if (!nav) return;
  const mobile = window.matchMedia('(max-width: 820px)');
  nav.id = 'mobile-site-navigation';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mobile-menu-toggle';
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span>Menyu</span><span class="mobile-menu-icon" aria-hidden="true"></span>';
  bar.prepend(toggle);
  bar.classList.add('mobile-enhanced');
  const setOpen = (open, restoreFocus = false) => {
    bar.classList.toggle('mobile-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menyunu bağla' : 'Menyunu aç');
    if (restoreFocus) toggle.focus();
  };
  setOpen(false);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('.item').forEach((item, index) => {
    const drop = item.querySelector('.drop');
    if (!drop) return;
    drop.id = `mobile-submenu-${index}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-submenu-toggle';
    button.textContent = '+';
    button.setAttribute('aria-label', `${item.querySelector('a').textContent.trim()}: alt menyu`);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', drop.id);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      item.classList.toggle('mobile-submenu-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? '−' : '+';
    });
    item.insertBefore(button, drop);
  });
  bar.addEventListener('keydown', event => {
    if (!mobile.matches || toggle.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); }
    if (event.key === 'Tab') {
      const controls = [toggle, ...nav.querySelectorAll('a,button')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', event => {
    if (mobile.matches && !bar.contains(event.target)) setOpen(false);
  });
  mobile.addEventListener('change', () => setOpen(false));
  // Retain every table and cell, containing wide data inside its own scroll region.
  document.querySelectorAll('table').forEach(table => {
    if (table.closest('.table-scroll,.table-card,.record-table-card,.ath-detail')) return;
    const wrap = document.createElement('div');
    wrap.className = 'mobile-table-scroll';
    table.before(wrap); wrap.append(table);
  });
  const tableRegions = document.querySelectorAll('.table-scroll,.table-card,.record-table-card,.mobile-table-scroll');
  const setTableAccessibility = () => tableRegions.forEach(region => {
    if (mobile.matches) {
      region.tabIndex = 0;
      region.setAttribute('role', 'region');
      region.setAttribute('aria-label', 'Cədvəl — üfüqi sürüşdürmə');
    } else {
      region.removeAttribute('tabindex');
      region.removeAttribute('role');
      region.removeAttribute('aria-label');
    }
  });
  setTableAccessibility();
  mobile.addEventListener('change', setTableAccessibility);
  // The four existing image-map links become readable artwork cards on mobile.
  const labels = ['Yarışların təqvimi', 'Nəticələr', 'Azərbaycan Rekordları', 'İdman dərəcələri'];
  document.querySelectorAll('.quick .q').forEach((link, index) => link.setAttribute('aria-label', labels[index]));
})();
