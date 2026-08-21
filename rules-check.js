(() => {
  const sessionKey = 'art-atlas-access-session-v1';
  const adminToken = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
      return session?.role === 'admin' && session.token ? session.token : '';
    } catch (_) { return ''; }
  };
  const ko = () => document.documentElement.lang !== 'en';
  const buttonText = () => ko() ? '전체 규칙 점검' : 'Check all rules';
  const updateButtons = () => document.querySelectorAll('[data-rules-check]').forEach(button => {
    button.hidden = !adminToken();
    if (!button.dataset.running) button.textContent = buttonText();
  });
  const report = result => {
    const stats = result.stats || {};
    return ko()
      ? `전체 규칙 점검 완료\n\n화가 ${stats.artists || 0}명 · 작품 ${stats.works || 0}점\n${result.changed ? '최신 규칙을 적용해 저장했습니다.' : '저장 데이터는 이미 최신 규칙과 일치합니다.'}\n이름 사전 ${stats.nameDictionary || 0}개 항목을 다시 생성했습니다.\n\n확인이 필요한 항목: 이미지 없는 작품 ${stats.missingPreview || 0}점, 제목 없는 작품 ${stats.missingTitle || 0}점`
      : `Rule check complete\n\n${stats.artists || 0} artists · ${stats.works || 0} works\n${result.changed ? 'Applied and saved current rules.' : 'Stored data already matches current rules.'}\nRebuilt ${stats.nameDictionary || 0} name records.\n\nNeeds attention: ${stats.missingPreview || 0} works without an image, ${stats.missingTitle || 0} without a title.`;
  };
  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-rules-check]');
    if (!button || button.disabled || !adminToken()) return;
    const question = ko()
      ? '모든 화면의 최신 표시·이름·작품 정리 규칙을 전체 자료에 적용합니다.\n수동 입력 작품과 대표작 선택은 유지합니다. 계속할까요?'
      : 'Apply current display, name, and artwork rules to all data? Manually entered works and highlight selections are preserved.';
    if (!confirm(question)) return;
    button.disabled = true;
    button.dataset.running = 'true';
    button.textContent = ko() ? '전체 점검 중…' : 'Checking…';
    try {
      const response = await fetch('/api/rules/check-and-apply', {method:'POST', headers:{Authorization:`Bearer ${adminToken()}`}});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
      alert(report(result));
      location.reload();
    } catch (error) {
      alert(ko() ? `전체 규칙 점검을 완료하지 못했습니다.\n${error.message || ''}` : `Could not complete the rule check.\n${error.message || ''}`);
    } finally {
      button.disabled = false;
      delete button.dataset.running;
      button.textContent = buttonText();
    }
  });
  new MutationObserver(updateButtons).observe(document.documentElement, {childList:true,subtree:true});
  window.addEventListener('storage', updateButtons);
  updateButtons();
})();
