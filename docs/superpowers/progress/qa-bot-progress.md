# QA Bot — 진행 상황

**스펙:** `docs/superpowers/specs/2026-06-28-qa-bot-design.md`
**계획:** `docs/superpowers/plans/2026-06-28-qa-bot.md`

## 상태

| Task | 내용 | 상태 |
|------|------|------|
| Task 1 | Bridge API 타입 정의 | ⬜ 대기 |
| Task 2 | Bridge 서버 스캐폴드 + /health | ⬜ 대기 |
| Task 3 | iOS 시뮬레이터 제어 모듈 | ⬜ 대기 |
| Task 4 | Maestro 실행 모듈 | ⬜ 대기 |
| Task 5 | 시각적 회귀 모듈 | ⬜ 대기 |
| Task 6 | /run 엔드포인트 완성 | ⬜ 대기 |
| Task 7 | Launchd 서비스 plist | ⬜ 대기 |
| Task 8 | QA Agent Group 스캐폴드 | ⬜ 대기 |
| Task 9 | Discord 채널 와이어링 | ⬜ 대기 |
| Task 10 | 사전 요구사항 설치 + E2E 테스트 | ⬜ 대기 |

## 메모

- iOS 우선, Android는 나중에
- Mac Bridge 포트: 17290
- 컨테이너 → Mac 호스트: `host.docker.internal:17290`
- 회귀 베이스라인 저장 위치: `data/qa-baselines/`
- Xcode, Maestro, ImageMagick 모두 Mac에 미설치 상태 → Task 10에서 설치
