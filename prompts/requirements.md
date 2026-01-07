# Detective Game - 케이스 관리 및 진행 시스템

## 프로젝트 개요
명탐정 게임 프로젝트로, 여러 케이스를 순차적으로 진행하는 구조입니다.

## 현재 구조
- 케이스 데이터: `src/data/cases.json`
- 케이스 로더: `src/utils/caseLoader.ts`
- 메인 페이지: `src/app/page.tsx`
- 시작 화면: `src/components/StartScreen.tsx`
- 게임 화면: `src/components/GameScreen.tsx`

## 요구사항

### 1. 케이스 추가
- `cases.json`에 새로운 케이스를 추가하면 자동으로 게임에 반영되어야 함
- 각 케이스는 고유한 `id`, `title`, `image`, `questions` 배열을 가짐
- 각 질문은 `id`, `text`, `answerRegions`, `explanation`을 가짐

### 2. 케이스 자동 진행
- 케이스 1의 모든 질문을 완료하면 자동으로 케이스 2로 전환
- 케이스 2 완료 시 케이스 3으로 전환 (이후 케이스들도 동일)
- 각 케이스 완료 시 **StartScreen을 거치지 않고 바로 다음 케이스의 GameScreen으로 전환**
- 다음 케이스로 넘어갈 때는 완료 메시지 없이 자연스럽게 전환
- 첫 번째 케이스 시작 시에만 StartScreen 표시, 이후 케이스 전환은 GameScreen 간 직접 전환

### 3. 총 질문 개수 표시
- StartScreen에서 현재 케이스의 질문 개수가 아닌, **모든 케이스의 총 질문 개수**를 표시
- 예: 케이스 1에 3개, 케이스 2에 2개가 있으면 "총 5개의 질문이 기다리고 있습니다" 표시

### 4. 완료 메시지
- 각 케이스가 끝날 때마다 완료 메시지를 표시하지 않음
- **모든 케이스의 모든 질문이 완료되었을 때만** 완료 메시지 표시
- 완료 메시지 예: "모든 질문을 완료했습니다! 🎉"

## 구현 변경사항

### `src/app/page.tsx`
- `caseId`를 하드코딩하지 않고 `currentCaseId` state로 관리
- `gameStarted` state로 첫 화면인지 게임 화면인지 구분
- `handleCaseComplete` 함수 구현:
  - 현재 케이스가 마지막 케이스가 아니면 `currentCaseId`만 업데이트하여 다음 케이스의 GameScreen으로 바로 전환 (메시지 없이, StartScreen 거치지 않음)
  - 마지막 케이스의 마지막 질문까지 완료했을 때만 완료 메시지 표시
- `GameScreen`에 `onCaseComplete` prop 전달

### `src/components/StartScreen.tsx`
- `getCases`를 import하여 모든 케이스 가져오기
- 모든 케이스의 질문 개수를 합산하여 총 질문 개수 계산
- 표시 텍스트를 `caseData.questions.length`에서 `totalQuestions`로 변경

### `src/components/GameScreen.tsx`
- `onCaseComplete?: () => void` prop 추가
- `handleNextQuestion`에서 현재 케이스의 모든 질문 완료 시:
  - `onCaseComplete`가 있으면 호출
  - 없으면 fallback으로 기본 메시지 표시

## 케이스 데이터 구조 예시

```json
{
  "cases": [
    {
      "id": 1,
      "title": "사건 1: 산장의 비밀",
      "image": "/images/Picsart_26-01-05_17-10-52-392.jpg",
      "questions": [
        {
          "id": 1,
          "text": "질문 텍스트",
          "answerRegions": [
            {
              "x": 0.25,
              "y": 0.7,
              "width": 0.3,
              "height": 0.3,
              "description": "정답 영역 설명"
            }
          ],
          "explanation": "정답 설명"
        }
      ]
    },
    {
      "id": 2,
      "title": "사건 2: 저택의 비밀",
      "image": "/images/Picsart_26-01-05_19-25-26-143.jpg",
      "questions": [...]
    }
  ]
}
```

## 참고사항
- 케이스 ID는 순차적으로 증가해야 함 (1, 2, 3, ...)
- 각 케이스의 질문 ID도 각 케이스 내에서 순차적으로 증가해야 함 (1, 2, 3, ...)
- 이미지 파일은 `public/images/` 폴더에 저장
- 정답 영역(`answerRegions`)의 좌표는 0~1 사이의 비율로 표현 (x, y, width, height)
- 개발자 도구 콘솔에서 이미지 클릭 시 좌표를 확인할 수 있음 (`ImageViewer.tsx`에 구현됨)

