# bubu

## Google Apps Script 자동 배포

GitHub는 소스 관리와 배포 자동화를 담당하고, 앱 실행과 데이터 저장은 계속
Google Apps Script와 Spreadsheet에서 처리합니다. `main` 브랜치에
`Code.gs`와 `index.html` 변경을 푸시하면 GitHub Actions가 `clasp`로 소스를
올리고 기존 웹앱 배포를 갱신합니다.

### 최초 설정

1. Apps Script 프로젝트 설정에서 Script ID를 확인하고, 해당 Google 계정으로
   Apps Script API를 활성화합니다.
2. GitHub 저장소의 **Settings → Secrets and variables → Actions → Variables**에
   다음 변수를 추가합니다.
   - `APPS_SCRIPT_ID`: Apps Script 프로젝트의 Script ID
   - `APPS_SCRIPT_DEPLOYMENT_ID`: 현재 웹앱 URL에서 `/s/`와 `/exec` 사이의 ID
3. 같은 화면의 **Secrets**에 `CLASPRC_JSON`을 추가합니다. 값은 `clasp login`으로
   인증한 계정의 `.clasprc.json` 내용입니다. Windows에서는 보통
   `%USERPROFILE%\.clasprc.json`에 있습니다. 토큰이므로 커밋하거나 채팅으로
   공유하지 마세요.
4. 첫 배포 전에 원격 프로젝트에 추가 소스 파일이 없는지 확인합니다.
   `.claspignore`는 `Code.gs`, `index.html`, `appsscript.json`을 업로드하며,
   `clasp push --force`는 이 저장소의 manifest로 원격 manifest를 덮어씁니다.
   `clasp push`는 원격 프로젝트의 소스 파일 전체를 교체합니다.
5. 설정 파일을 `main`에 푸시하면 자동 배포됩니다. 또는 GitHub Actions에서
   **Deploy Apps Script**를 수동 실행할 수 있습니다.

기존 배포를 갱신하므로 프런트엔드에서 사용하는 웹앱 URL은 유지됩니다.