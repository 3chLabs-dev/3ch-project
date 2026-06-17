# 3ch Mobile (React Native)

`3ch-api` 서버를 그대로 사용하고, `3ch-web`의 사용자용 주요 기능을 모바일 앱으로 옮긴 Expo React Native 프로젝트입니다.

현재 앱 이름은 **우리리그**이며 Android 테스트 APK와 Play Store용 AAB 빌드 구성을 포함합니다.

---

## 프로젝트 목표

- 기존 웹 서비스를 모바일 앱에서 사용할 수 있도록 별도 경로(`3ch-mobile`)로 구현
- 서버 API는 재작성하지 않고 `3ch-api`를 그대로 사용
- 로그인, 클럽, 리그·대회, 추첨, 마이페이지 등 사용자 핵심 기능 제공
- Android 테스트 APK를 빠르게 생성해 실제 기기에서 검증 가능하게 구성

---

## 기술 스택

- **Framework**: Expo SDK 56 + React Native 0.85
- **Language**: TypeScript
- **Navigation**: React Navigation 7
- **State Management**: Redux Toolkit + RTK Query
- **Secure Storage**: expo-secure-store
- **Location**: expo-location
- **Clipboard**: expo-clipboard
- **Icons**: @expo/vector-icons
- **Build**: EAS Build

---

## 프로젝트 구조

```text
3ch-mobile/
├─ assets/                  # 앱 아이콘, 배너 이미지
├─ src/
│  ├─ api/                  # RTK Query API 정의
│  │  ├─ baseApi.ts
│  │  └─ mobileApi.ts
│  ├─ components/           # 공통 UI, Screen, 클럽 선택 등
│  ├─ navigation/           # 탭/스택 네비게이션
│  ├─ screens/              # 앱 화면
│  ├─ store/                # Redux store, auth/app slice
│  └─ theme.ts              # 색상 토큰
├─ App.tsx                  # 앱 진입점
├─ app.json                 # Expo 앱 설정
├─ eas.json                 # EAS 빌드 프로필
├─ package.json
└─ README.md
```

---

## 환경 변수

앱은 `EXPO_PUBLIC_API_BASE_URL`을 사용해 API 서버에 연결합니다.

`.env.example`을 복사해 `.env`를 만듭니다.

```powershell
Copy-Item .env.example .env
```

프로덕션 서버를 사용할 때:

```env
EXPO_PUBLIC_API_BASE_URL=https://woorileague.com/api
```

로컬 API 서버를 실제 기기에서 테스트할 때는 `localhost` 대신 개발 PC의 LAN IP를 사용해야 합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:3000/api
```

---

## 설치 및 실행

### 1. 의존성 설치

```powershell
npm install
```

### 2. Expo 개발 서버 실행

```powershell
npm start
```

Android 또는 iPhone에 **Expo Go**를 설치한 뒤 QR 코드를 스캔하면 됩니다.

이 방식은 Android Studio나 Android SDK 없이도 빠르게 확인할 수 있습니다.

---

## Android 에뮬레이터 실행

`npm run android`는 Android Studio, Android SDK, 실행 중인 에뮬레이터 또는 USB 연결 기기가 필요합니다.

Android Studio 설치:

```powershell
winget install --exact --id Google.AndroidStudio
```

Android Studio에서 다음 항목을 설치합니다.

- Android SDK Platform
- Android SDK Platform-Tools
- Android Emulator
- Device Manager의 가상 기기

PowerShell에서 SDK 경로를 설정합니다.

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
adb devices
npm run android
```

사용자 환경 변수로 영구 저장하려면:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", "User")
```

---

## 테스트 APK 빌드

최초 1회 Expo 계정 로그인과 EAS 프로젝트 연결이 필요합니다.

```powershell
npx eas-cli login
npx eas-cli init
```

테스트용 설치 APK 생성:

```powershell
npm run build:android:apk
```

빌드가 완료되면 EAS가 APK 다운로드 링크를 출력합니다.

기존 앱 위에 설치:

```powershell
adb install -r .\woori-league-preview.apk
```

Play Store 제출용 AAB 생성:

```powershell
npm run build:android:aab
```

---

## 로컬 APK 직접 빌드

EAS를 쓰지 않고 로컬에서 debug APK를 만들 수도 있습니다.

```powershell
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleDebug
```

생성 위치:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

`android/` 폴더는 생성 산출물이며 Git에 포함하지 않습니다.

---

## 구현된 주요 기능

### 인증

- 이메일 로그인
- 이메일 회원가입
- JWT 토큰 보안 저장
- 사용자 정보 조회 및 정보 수정
- 로그아웃

### 홈

- 메인 배너
- 선호 클럽 기반 홈 요약
- 나의 조편성
- 나의 경기
- 나의 당첨 내역
- 홈 표시 항목 설정

### 클럽

- 가입 클럽 목록
- 전역 클럽 선택 및 저장
- 클럽 생성
- 클럽 검색
- 위치 기반 클럽 추천
- 종목 필터 기반 추천
- 가입 클럽 지역 기반 추천
- 클럽 상세
- 클럽 가입 및 탈퇴
- 클럽 회원 목록
- 클럽 순위

### 리그·대회

- 리그 목록
- 선택 클럽 기준 필터
- 리그 생성
- 리그 상세
- 참가자 목록
- 참가자 추가
- 참가자 출석/결제 상태 변경
- 경기 생성
- 경기 점수 입력
- 경기 종료 처리

### 추첨

- 리그별 추첨 목록
- 추첨 결과 상세
- 경품별 당첨자 확인

### 마이페이지

- 프로필 요약
- 정보수정
- 순위 허브
- 종목별 개인 통합 순위
- 클럽별 순위
- 이용방법
- 요금제 및 현재 구독 조회
- 후원 계좌 안내 및 복사
- 공지사항 목록 및 상세
- FAQ 역할별 분류 및 답변 펼침
- 1:1 문의 작성, 상세, 답변 확인
- 채팅 문의
- 이용약관
- 개인정보 처리방침

---

## 아직 네이티브 통합이 필요한 기능

아래 항목은 단순 API 호출만으로 끝나지 않고, 모바일 전용 SDK 또는 권한/콜백 설계가 필요합니다.

- Google, Kakao, Naver 소셜 로그인 네이티브 연동
- FCM/APNs 푸시 알림
- Toss Payments 모바일 결제 SDK 또는 웹뷰 결제 플로우
- OMR 카메라 촬영 및 이미지 업로드 UX
- 대진표 이미지 저장, 공유, 인쇄
- 채팅 문의의 WebSocket 실시간 수신 고도화

---

## Android Safe Area

Android 시스템 내비게이션 버튼과 앱 하단 탭이 겹치지 않도록 `react-native-safe-area-context`를 사용합니다.

- `App.tsx`에서 `SafeAreaProvider` 적용
- `Screen` 컴포넌트에서 Safe Area 적용
- 하단 탭은 실제 `bottom inset`을 읽어 동적으로 높이와 padding을 계산

---

## 주요 명령어

```powershell
npm start                 # Expo 개발 서버
npm run android           # Android 에뮬레이터/기기 실행
npm run ios               # iOS 실행
npm run web               # Expo web 실행
npm run typecheck         # TypeScript 검사
npm run build:android:apk # 테스트 APK 빌드
npm run build:android:aab # Play Store용 AAB 빌드
```

---

## 검증

코드 변경 후 기본적으로 아래 두 가지를 확인합니다.

```powershell
npm run typecheck
npx expo export --platform android --output-dir .expo-export-test
```

테스트 export 폴더는 검증 후 삭제합니다.

---

## 문제 해결

### `adb`를 찾을 수 없음

Android SDK Platform-Tools가 설치되어 있고 PATH에 포함되어 있는지 확인합니다.

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools"
adb devices
```

### `ANDROID_HOME is set to a non-existing path`

Android Studio의 SDK Manager에서 실제 SDK 설치 경로를 확인한 뒤 `ANDROID_HOME`을 맞춥니다.

일반적인 Windows 경로:

```text
C:\Users\<사용자>\AppData\Local\Android\Sdk
```

### 실제 기기에서 로컬 API 연결 실패

실제 기기에서 `localhost`는 개발 PC가 아니라 휴대폰 자신을 의미합니다.

개발 PC의 LAN IP를 `.env`에 넣어야 합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:3000/api
```

### EAS 빌드 다운로드 위치

EAS 빌드 완료 후 출력되는 링크에서 APK를 다운로드합니다.

빌드 결과 URL을 알고 있으면 직접 받을 수도 있습니다.

```powershell
Invoke-WebRequest -Uri "<APK_URL>" -OutFile ".\woori-league-preview.apk"
```

### 하단 탭이 Android 뒤로가기 버튼과 겹침

최신 빌드인지 확인합니다. Safe Area 수정 전 APK를 설치한 경우 다시 빌드해야 합니다.

```powershell
npm run build:android:apk
```

---

## 참고

- 모바일 앱은 `3ch-api`의 `/api` prefix를 포함한 엔드포인트를 사용합니다.
- 인증이 필요한 API는 `Authorization: Bearer <token>` 헤더를 자동으로 붙입니다.
- 빌드 산출물 APK/AAB와 `android/`, `ios/`, `.expo/`, `node_modules/`는 Git에 포함하지 않습니다.
- 테스트 APK는 내부 배포용이며 Play Store 제출은 AAB 빌드를 사용합니다.
