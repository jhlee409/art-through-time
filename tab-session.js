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
