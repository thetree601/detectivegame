# Detective Game - 케이스 목록 모달 기능 추가

## 프로젝트 개요
명탐정 게임에서 사용자가 원하는 케이스를 선택하여 바로 시작할 수 있도록 케이스 목록 모달 기능을 추가합니다.

## 문제점
- 현재는 5개의 질문을 연달아 맞춰야 하는 구조
- 이미 케이스 1을 풀었어도 케이스 2만 다시 풀고 싶을 때 케이스 1을 또 풀어야 하는 불편함
- '퀴즈 목록 보기' 버튼을 누르면 메인 화면으로 이동하는데, 이는 사용자 경험에 좋지 않음

## 해결 방안
- '퀴즈 목록 보기' 버튼 클릭 시 케이스 목록 모달 표시
- 모달 방식 채택 (기존 FeedbackModal과 일관성 유지, 더 나은 UX)
- 각 케이스를 버튼으로 표시하고, 클릭 시 해당 케이스의 첫 번째 질문으로 바로 이동

## 요구사항

### 1. 케이스 목록 모달 기능
- FeedbackModal의 '퀴즈 목록 보기' 버튼 클릭 시 케이스 목록 모달 표시
- 모달에는 모든 케이스가 버튼 형태로 표시됨
  - 예: "1. 산장의 비밀", "2. 저택의 비밀" 등
  - 케이스 제목에서 "사건 X: " 부분은 제거하여 표시 (예: "사건 1: 산장의 비밀" → "산장의 비밀")
- 각 케이스 버튼 클릭 시 해당 케이스의 첫 번째 질문으로 바로 이동
- `cases.json`에 케이스가 추가되면 자동으로 목록에 반영됨
- 케이스가 많아지면 스크롤 가능하도록 구현
- 모달 배경(overlay) 클릭 시 모달 닫기
- 모달 내 '닫기' 버튼도 제공

### 2. UI 요구사항
- 기존 앱의 전반적 분위기와 일치하는 디자인
- FeedbackModal과 유사한 스타일 유지
- 케이스 버튼은 명확하게 구분되고 클릭하기 쉬워야 함
- 다크 테마와 일치하는 색상 사용

## 구현 변경사항

### `src/app/page.tsx`
- `showCaseListModal` state 추가 (boolean)
- `handleCaseSelect` 함수 추가:
  - 케이스 ID를 받아서 해당 케이스의 첫 번째 질문으로 이동
  - `currentCaseId` 업데이트
  - `gameStarted`를 true로 설정하여 GameScreen으로 전환
  - 케이스 목록 모달 닫기 (`setShowCaseListModal(false)`)
- `handleOpenCaseList` 함수 추가:
  - 케이스 목록 모달 열기 (`setShowCaseListModal(true)`)
- `GameScreen`에 `onOpenCaseList` prop 전달
- `CaseListModal` 컴포넌트 추가 및 렌더링
  - `isOpen={showCaseListModal}`
  - `onClose={() => setShowCaseListModal(false)}`
  - `onCaseSelect={handleCaseSelect}`

### `src/components/GameScreen.tsx`
- `onOpenCaseList?: () => void` prop 추가
- `handleGoToQuizList` 함수를 `handleOpenCaseList`로 변경:
  - `onOpenCaseList`가 있으면 호출
  - 없으면 fallback으로 기존 동작 유지
- `FeedbackModal`에 `onOpenCaseList` prop 전달

### `src/components/FeedbackModal.tsx`
- `onGoToQuizList` prop을 `onOpenCaseList?: () => void`로 변경
- 버튼 텍스트는 "퀴즈 목록 보기" 유지
- `onGoToQuizList` 호출 부분을 `onOpenCaseList`로 변경

### `src/components/CaseListModal.tsx` (새로 생성)
- 케이스 목록을 표시하는 모달 컴포넌트
- Props:
  - `isOpen: boolean` - 모달 표시 여부
  - `onClose: () => void` - 모달 닫기 함수
  - `onCaseSelect: (caseId: number) => void` - 케이스 선택 시 호출되는 함수
- 기능:
  - `getCases()`로 모든 케이스 가져오기
  - 각 케이스를 버튼으로 표시
  - 케이스 제목에서 "사건 X: " 부분 제거하여 표시
    - 정규식 사용: `title.replace(/^사건 \d+: /, '')`
  - 케이스가 많을 경우 스크롤 가능한 리스트
  - 모달 배경 클릭 시 닫기 (`onClose` 호출)
  - '닫기' 버튼 제공
- 구조:
  ```tsx
  <div className={styles.modalOverlay} onClick={onClose}>
    <div className={styles.caseListModal} onClick={(e) => e.stopPropagation()}>
      <h2 className={styles.caseListTitle}>케이스 선택</h2>
      <div className={styles.caseListScrollContainer}>
        {cases.map((case_) => (
          <button
            key={case_.id}
            onClick={() => onCaseSelect(case_.id)}
            className={styles.caseListItem}
          >
            {case_.id}. {case_.title.replace(/^사건 \d+: /, '')}
          </button>
        ))}
      </div>
      <button onClick={onClose} className={styles.secondaryButton}>
        닫기
      </button>
    </div>
  </div>
  ```

### `src/styles/components.module.css`
- `caseListModal` 클래스 추가:
  - FeedbackModal과 유사한 스타일
  - 배경: white
  - border-radius: 0.75rem
  - padding: 1.5rem
  - max-width: 28rem
  - width: 100%
  - box-shadow: FeedbackModal과 동일
  - max-height: 90vh
- `caseListTitle` 클래스 추가:
  - 모달 제목 스타일
  - font-size: 1.25rem
  - font-weight: bold
  - margin-bottom: 1rem
  - text-align: center
  - color: #1f2937
- `caseListScrollContainer` 클래스 추가:
  - 스크롤 가능한 컨테이너
  - max-height: 60vh
  - overflow-y: auto
  - margin-bottom: 1rem
  - display: flex
  - flex-direction: column
  - gap: 0.75rem
- `caseListItem` 클래스 추가:
  - 각 케이스 버튼 스타일
  - width: 100%
  - padding: 1rem
  - background: #f9fafb
  - border: 1px solid #e5e7eb
  - border-radius: 0.5rem
  - font-size: 1rem
  - font-weight: 600
  - color: #1f2937
  - text-align: left
  - cursor: pointer
  - transition: all 0.2s
  - hover 시: background: #f3f4f6, border-color: #2563eb
  - active 시: transform: scale(0.98)

## 케이스 데이터 구조 참고

```json
{
  "cases": [
    {
      "id": 1,
      "title": "사건 1: 산장의 비밀",
      ...
    },
    {
      "id": 2,
      "title": "사건 2: 저택의 비밀",
      ...
    }
  ]
}
```

## 참고사항
- 케이스 제목에서 "사건 X: " 부분은 정규식으로 제거: `title.replace(/^사건 \d+: /, '')`
- 모달은 `modalOverlay` 클래스를 재사용하여 FeedbackModal과 동일한 배경 스타일 유지
- 케이스가 추가되면 자동으로 목록에 반영되므로 별도의 업데이트 작업 불필요
- 모달 내부 클릭 시 이벤트 전파 방지 (`stopPropagation`)로 모달이 닫히지 않도록 처리
- 반응형 디자인 고려 (모바일에서도 잘 보이도록)

