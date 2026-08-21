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
    const hidden = !adminToken();
    if (button.hidden !== hidden) button.hidden = hidden;
    const label = buttonText();
    if (!button.dataset.running && button.textContent !== label) button.textContent = label;
  });
  const report = result => {
    const stats = result.stats || {};
    return ko()
      ? `전체 규칙 점검 완료\n\n화가 ${stats.artists || 0}명 · 작품 ${stats.works || 0}점\n${result.changed ? '최신 규칙을 적용해 저장했습니다.' : '저장 데이터는 이미 최신 규칙과 일치합니다.'}\n이름 사전 ${stats.nameDictionary || 0}개 항목을 다시 생성했습니다.\n\n확인이 필요한 항목: 이미지 없는 작품 ${stats.missingPreview || 0}점, 제목 없는 작품 ${stats.missingTitle || 0}점, QID 제목 ${stats.qidTitle || 0}점\n화가 표시: 한국어 ${stats.artistDisplayKorean || 0}점, 성·이름 순서 ${stats.artistDisplayOrder || 0}점, 국가 아이콘 ${stats.artistCountryIcon || 0}점, uHangul 연결 ${stats.uHangulConnection || 0}점\n기법 설명: 제목 옆 + 버튼 ${stats.techniqueTitleLinkButton || 0}점\n썸네일 제목: 화가명·소장처 혼입 ${stats.thumbnailTitleExtra || 0}점\n검토 완료 이미지 없음: ${stats.reviewedNoPublicImage || 0}점\n\n보고서: ${result.reportFile || '변경사항/규칙점검_날짜_시간.md'}`
      : `Rule check complete\n\n${stats.artists || 0} artists · ${stats.works || 0} works\n${result.changed ? 'Applied and saved current rules.' : 'Stored data already matches current rules.'}\nRebuilt ${stats.nameDictionary || 0} name records.\n\nNeeds attention: ${stats.missingPreview || 0} works without an image, ${stats.missingTitle || 0} without a title, ${stats.qidTitle || 0} QID titles.\nArtist display: ${stats.artistDisplayKorean || 0} non-Korean, ${stats.artistDisplayOrder || 0} name-order, ${stats.artistCountryIcon || 0} country-icon, ${stats.uHangulConnection || 0} uHangul connection.\nTechnique title + buttons: ${stats.techniqueTitleLinkButton || 0}.\nThumbnail titles with artist/collection extras: ${stats.thumbnailTitleExtra || 0}.\nReviewed without public images: ${stats.reviewedNoPublicImage || 0}.\n\nReport: ${result.reportFile || 'changes/rule-check_date_time.md'}`;
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
