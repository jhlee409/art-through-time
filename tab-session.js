(() => {
  const sessionKey = 'art-atlas-access-session-v1';
  const sharedSessionKey = 'art-atlas-access-session-shared-v1';
  const logoutKey = 'art-atlas-logout-signal';
  const loginUrl = () => new URL('index.html?login=1', location.href).href;
  const closeOrReturnToLogin = () => {
    try { sessionStorage.removeItem(sessionKey); localStorage.removeItem(sharedSessionKey); } catch (_) {}
    // Tabs opened by the app can close themselves. Browser security may keep a
    // user-opened root tab alive, in which case it is returned to the login page.
    try { window.close(); } catch (_) {}
    setTimeout(() => location.assign(loginUrl()), 80);
  };
  window.artThroughTimeLogoutAll = async () => {
    let token = '';
    try { token = JSON.parse(sessionStorage.getItem(sessionKey) || 'null')?.token || ''; } catch (_) {}
    try { await fetch('/api/auth/logout', {method:'POST', headers:token ? {Authorization:`Bearer ${token}`} : {}, cache:'no-store'}); } catch (_) {}
    try {
      sessionStorage.removeItem(sessionKey);
      localStorage.removeItem(sharedSessionKey);
      localStorage.setItem(logoutKey, JSON.stringify({at:Date.now(), source:Math.random().toString(36).slice(2)}));
    } catch (_) {}
    location.assign(loginUrl());
  };
  window.addEventListener('storage', event => {
    if (event.key === logoutKey && event.newValue) closeOrReturnToLogin();
  });
})();

(() => {
  const collapsedKey = 'art-atlas-sidebar-collapsed-v1';
  const sidebarSelectors = ['.sidebar', '.technique-sidebar', '.topic-sidebar'];
  const shellSelectors = ['.app-shell', '.technique-shell', '.topics-shell'];

  const storedCollapsed = () => {
    try { return sessionStorage.getItem(collapsedKey) === '1'; } catch (_) { return false; }
  };
  const storeCollapsed = collapsed => {
    try { sessionStorage.setItem(collapsedKey, collapsed ? '1' : '0'); } catch (_) {}
  };
  const label = collapsed => {
    const ko = (document.documentElement.lang || '').toLowerCase().startsWith('ko');
    if (collapsed) return ko ? '사이드바 보이기' : 'Show sidebar';
    return ko ? '사이드바 감추기' : 'Hide sidebar';
  };
  const sidebar = () => sidebarSelectors.map(selector => document.querySelector(selector)).find(Boolean);
  const shell = () => shellSelectors.map(selector => document.querySelector(selector)).find(Boolean);

  function setButtonState(button, collapsed) {
    if (!button) return;
    const text = label(collapsed);
    button.title = text;
    button.setAttribute('aria-label', text);
    button.setAttribute('aria-expanded', String(!collapsed));
  }

  function apply(collapsed) {
    const currentSidebar = sidebar();
    const currentShell = shell();
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    if (currentSidebar) currentSidebar.setAttribute('aria-hidden', String(collapsed));
    if (currentShell) currentShell.classList.toggle('sidebar-collapsed', collapsed);
    setButtonState(document.querySelector('[data-sidebar-toggle="collapse"]'), collapsed);
    setButtonState(document.querySelector('[data-sidebar-toggle="restore"]'), collapsed);
  }

  function button(kind) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = kind === 'restore' ? 'sidebar-restore-toggle' : 'sidebar-toggle';
    element.dataset.sidebarToggle = kind;
    const arrow = kind === 'restore' ? 'M14 9l3 3-3 3' : 'M17 9l-3 3 3 3';
    element.innerHTML = `<svg class="sidebar-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16"></path><path d="${arrow}"></path></svg>`;
    return element;
  }

  function focusButton(element) {
    try { element.focus({preventScroll: true}); } catch (_) { element.focus(); }
  }

  function init() {
    const currentSidebar = sidebar();
    if (!currentSidebar || currentSidebar.dataset.sidebarToggleReady === 'true') return;
    currentSidebar.dataset.sidebarToggleReady = 'true';
    if (!currentSidebar.id) currentSidebar.id = 'art-atlas-sidebar';
    const collapseButton = button('collapse');
    const restoreButton = button('restore');
    collapseButton.setAttribute('aria-controls', currentSidebar.id);
    restoreButton.setAttribute('aria-controls', currentSidebar.id);
    currentSidebar.prepend(collapseButton);
    document.body.append(restoreButton);
    collapseButton.addEventListener('click', () => {
      storeCollapsed(true);
      apply(true);
      focusButton(restoreButton);
    });
    restoreButton.addEventListener('click', () => {
      storeCollapsed(false);
      apply(false);
      focusButton(collapseButton);
    });
    apply(storedCollapsed());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
