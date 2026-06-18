# 3ch Mobile

우리리그 모바일 앱입니다. Expo React Native 기반이며 `3ch-api` 서버를 그대로 사용합니다.

---

## 보안 원칙

- README에는 실제 API 도메인, 서버 IP, Expo 계정, EAS project ID, 키 값을 남기지 않습니다.
- 실제 값은 `.env`, `app.json`, `eas.json`, EAS 환경 변수, Expo 계정 설정에서 관리합니다.
- APK/AAB 빌드 산출물과 `.env`는 Git에 커밋하지 않습니다.

---

## 기술 스택

- **Framework**: Expo SDK 56 + React Native 0.85
- **Language**: TypeScript
- **Navigation**: React Navigation 7
- **State**: Redux Toolkit + RTK Query
- **Secure Storage**: expo-secure-store
- **Location**: expo-location
- **Clipboard**: expo-clipboard
- **Safe Area**: react-native-safe-area-context
- **Build**: EAS Build

---

## 폴더 구조

```text
3ch-mobile/
├─ assets/
├─ src/
│  ├─ api/          # RTK Query API
│  ├─ components/   # 공통 UI
│  ├─ navigation/   # 탭/스택 네비게이션
│  ├─ screens/      # 화면
│  ├─ store/        # Redux store/slices
│  └─ theme.ts
├─ App.tsx
├─ app.json
├─ eas.json
├─ package.json
└─ README.md
```

---

## 환경 변수

```dotenv
EXPO_PUBLIC_API_BASE_URL=<API_BASE_URL>
```

실제 기기에서 로컬 API를 사용할 때는 개발 PC의 LAN IP를 사용합니다.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://<LOCAL_LAN_IP>:<API_PORT>/api
```

---

## 설치 및 실행

```powershell
npm install
npm start
```

Expo Go 앱으로 QR 코드를 스캔하면 빠르게 확인할 수 있습니다.

Android 에뮬레이터 또는 USB 기기 실행:

```powershell
npm run android
```

---

## Android SDK 설정

`npm run android`에서 `adb` 또는 Android SDK 오류가 나면 다음을 확인합니다.

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
adb devices
```

환경 변수로 영구 저장:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", "User")
```

---

## 빌드

최초 1회:

```powershell
npx eas-cli login
npx eas-cli init
```

테스트 APK:

```powershell
npm run build:android:apk
```

Play Store 제출용 AAB:

```powershell
npm run build:android:aab
```

APK를 직접 내려받은 경우 설치:

```powershell
adb install -r .\woori-league-preview.apk
```

---

## 로컬 debug APK

EAS 없이 로컬에서 debug APK를 만들 수 있습니다.

```powershell
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleDebug
```

생성 위치:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

`android/`와 `ios/`는 생성 산출물이므로 Git에 포함하지 않습니다.

---

## 구현된 화면

### 탭

- 홈
- 리그·대회
- 클럽
- 추첨
- 마이

### 인증

- 이메일 로그인
- 이메일 회원가입
- JWT 토큰 보안 저장
- 사용자 정보 수정
- 로그아웃

### 홈

- 메인 배너
- 선택 클럽 기반 홈 요약
- 나의 조편성
- 나의 경기
- 나의 당첨 내역
- 홈 표시 설정

### 클럽

- 가입 클럽 목록
- 클럽 생성
- 클럽 검색
- 위치 기반 추천
- 종목 필터 추천
- 지역 기반 추천
- 클럽 상세
- 클럽 가입/탈퇴
- 회원 목록
- 클럽 순위

### 리그·대회

- 리그 목록
- 리그 생성
- 리그 상세
- 참가자 목록
- 참가자 추가
- 출석/결제 상태 변경
- 경기 생성
- 점수 입력
- 경기 종료 처리

### 추첨

- 리그별 추첨 목록
- 추첨 결과 상세
- 경품별 당첨자 확인

### 마이페이지

- 프로필
- 설정
- 정보수정
- 순위 허브
- 종목별 개인 순위
- 클럽별 순위
- 이용방법
- 요금제/현재 구독
- 후원 계좌 복사
- 공지사항
- FAQ
- 1:1 문의
- 채팅 문의
- 이용약관
- 개인정보 처리방침

---

## 네이티브 통합이 더 필요한 기능

- Google/Kakao/Naver 네이티브 소셜 로그인
- FCM/APNs 푸시 알림
- 모바일 결제 플로우
- OMR 카메라 촬영/업로드 UX
- 대진표 이미지 저장, 공유, 인쇄
- 채팅 문의 WebSocket 수신 고도화

---

## Android Safe Area

Android 시스템 내비게이션 영역과 앱 하단 탭이 겹치지 않도록 처리합니다.

- `App.tsx`: `SafeAreaProvider`
- `src/components/Screen.tsx`: `SafeAreaView`
- `src/navigation/AppNavigator.tsx`: `useSafeAreaInsets()`로 하단 탭 높이 계산

---

## 주요 명령어

```powershell
npm start
npm run android
npm run ios
npm run web
npm run typecheck
npm run build:android:apk
npm run build:android:aab
```

---

## 검증

```powershell
npm run typecheck
npx expo export --platform android --output-dir .expo-export-test
```

검증 후 `.expo-export-test`는 삭제합니다.

---

## Git 제외 권장

- `.env`
- `.expo/`
- `node_modules/`
- `android/`, `ios/`
- `*.apk`
- `*.aab`
