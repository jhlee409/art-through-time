# Art Through Time 작업 규칙

## 이미지 파일 다운로드 승인 규칙

- URL에서 이미지 파일을 찾아 다운로드하거나, URL 응답을 파일로 저장하는 작업은 반드시 사용자에게 먼저 명시적으로 허락을 받아야 한다.
- 사용자가 "다운로드 폴더"라고 말하면 `C:\Users\jhlee\OneDrive - UOU\AI-Programming\Art_through_Time\download` 안의 기존 로컬 파일만 사용한다.
- 화가 작품 이미지, 미술사조 이미지, 기법·용어 이미지, 주제 이미지에는 외부 이미지 URL 의존을 새로 만들지 않는다. 로컬 파일이 없으면 사용자에게 파일을 넣어 달라고 말한다.
- Wikipedia, Wikidata, museum pages, 웹 검색은 원어명, 생몰년, 국적, 작품명, 설명, 출처 확인 같은 텍스트 정보 보충에만 사용한다.
- 정말 URL 이미지 파일 다운로드가 필요할 때는 실행 전에 사용자에게 어떤 URL/사이트에서 어떤 파일을 받을지 설명하고 허락을 받은 뒤 진행한다.
- URL 파일 다운로드 스크립트를 새로 만들 경우 `tools/url-download-permission.js`의 `requireUrlFileDownloadApproval()`을 호출해야 하며, 검사 도구 `node tools/check-url-download-approval.js`를 통과해야 한다.
