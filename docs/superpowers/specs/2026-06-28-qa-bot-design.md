# QA Bot Design

Date: 2026-06-28

## Overview

A Discord-based QA automation bot that accepts iOS app files (IPA) and optional spec documents (PDF/MD), generates Maestro test scenarios, executes them on a local iOS Simulator via a Mac host bridge, performs visual regression comparison, and posts a structured test report back to Discord.

Android support is deferred to a later phase.

---

## Architecture

```
Discord QA Channel
    ↓ IPA path or attachment + optional spec (PDF/MD)
qa-bot agent (Linux container)
    → IPA static analysis (Info.plist, bundle structure, permissions, screen names)
    → Spec parsing (PDF via pdftotext, MD directly)
    → Maestro YAML flow generation
    ↓ HTTP POST to host.docker.internal:17290
Mac Bridge Server (Mac host, launchd service)
    → iOS Simulator boot (xcrun simctl)
    → IPA install + Maestro test execution
    → Screenshot capture per flow step
    → Visual regression diff (ImageMagick compare)
    ↓ JSON results + screenshots
qa-bot
    → Test report generation → Discord message + MD file attachment
```

---

## Components

### 1. `groups/qa-bot/` — Agent Group

- `CLAUDE.md` — QA persona and workflow instructions
- `container.json` — provider, packages (`pdftotext`, `unzip`)
- `webhook.json` — custom Discord name + avatar URL

### 2. `scripts/qa-bridge.ts` — Mac Host Bridge

Lightweight HTTP server (port 17290) running as a launchd service.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/run` | Receive IPA path + Maestro YAML flows, execute, return results |
| `POST` | `/baseline` | Save current screenshots as regression baseline |
| `GET`  | `/baseline/:bundleId/:flowName` | Retrieve baseline screenshots for a flow |
| `GET`  | `/health` | Liveness check |

**`POST /run` request body:**
```json
{
  "ipaPath": "/Users/jin/Downloads/MyApp.ipa",
  "flows": [{ "name": "login_flow", "yaml": "..." }],
  "deviceId": "booted",
  "runId": "run-2026-06-28-001"
}
```

**`POST /run` response:**
```json
{
  "runId": "run-2026-06-28-001",
  "results": [
    { "name": "login_flow", "passed": true, "durationMs": 4200, "screenshots": ["...base64..."] }
  ],
  "regressionDiffs": [
    { "name": "home_screen", "diffPercent": 2.3, "diffImageBase64": "..." }
  ]
}
```

### 3. `data/qa-baselines/` — Baseline Storage

Per-app baseline screenshots stored on Mac host, keyed by bundle ID + flow name.

```
data/qa-baselines/
  com.example.myapp/
    login_flow/
      step-01.png
      step-02.png
    home_screen/
      step-01.png
```

---

## File Input Methods

| Method | When to use |
|--------|-------------|
| Discord file attachment | IPA/spec ≤ 25MB |
| Local path in message | Large IPA (typical case) |

**Trigger format:**
```
qa /Users/jin/Downloads/MyApp.ipa
qa /Users/jin/Downloads/MyApp.ipa spec:/Users/jin/Downloads/plan.pdf
```
Or attach file directly to the message (≤25MB).

---

## QA Workflow (Step by Step)

1. User sends message with IPA path/attachment + optional spec in QA channel
2. Bot downloads or reads IPA → extracts with `unzip` → parses `Info.plist` (bundle ID, version, display name, supported orientations)
3. Bot scans bundle for storyboard/XIB/SwiftUI view names to infer screen structure
4. If spec provided: parse PDF (`pdftotext`) or read MD → extract feature list and user flows
5. Bot generates Maestro YAML flows for each identified screen/feature
6. Bot POSTs to Mac Bridge `/run` with IPA path + generated flows
7. Mac Bridge: boots simulator if needed → installs IPA → runs each Maestro flow → captures screenshots
8. Mac Bridge returns results + screenshots
9. If baseline exists: run ImageMagick `compare` per screenshot, flag diffs > 1%
10. If no baseline: auto-save current screenshots as baseline, note in report
11. Bot formats and posts report to Discord

---

## Error Handling

| Situation | Response |
|-----------|----------|
| IPA > 25MB via attachment | Prompt user to use local path format instead |
| Mac Bridge unreachable | "Mac Bridge가 실행 중인지 확인해주세요 (`pnpm run qa-bridge`)" |
| Bridge timeout (30s) | Retry once, then report timeout with partial results |
| Simulator boot failure | Bridge retries once, returns error with `xcrun simctl` log |
| Maestro flow fails | Continue remaining flows, mark failed flow in report |
| No baseline on regression run | Auto-save as new baseline, notify in report |
| pdftotext not available | Fall back to filename-only context, warn in report |

---

## Test Report Format

**Discord inline summary:**
```
📋 QA 결과 — MyApp v1.2.3 (com.example.myapp)
──────────────────────────────────────────────
✅ 통과   8 / 10
❌ 실패   2 / 10
📸 회귀 변경  1건

❌ 실패 항목
  • 로그인_비밀번호_오류처리 — 오류 메시지 미표시
  • 결제_카드등록 — 타임아웃 (5s)

⚠️ 회귀 변경
  • 홈_메인화면 — 레이아웃 변경 감지 (2.3% diff)

📄 전체 보고서 첨부: qa-report-2026-06-28-001.md
```

**MD report (attached file):** Per-flow breakdown with Maestro YAML, pass/fail, screenshots (base64 inline or file path), regression diff images, and raw Maestro output.

---

## Mac Bridge Setup

Dependencies installed on Mac host:
- Xcode (for iOS Simulator + `xcrun simctl`)
- Maestro (`brew install maestro`)
- ImageMagick (`brew install imagemagick`)

Bridge runs as launchd service:
- Plist: `~/Library/LaunchAgents/com.nanoclaw.qa-bridge.plist`
- Start: `launchctl load ~/Library/LaunchAgents/com.nanoclaw.qa-bridge.plist`

---

## Deferred

- Android (APK) support — same architecture, Mac Bridge adds `adb` + `avdmanager` path
- Nitro/large file Discord upload support
- CI/CD integration (trigger QA from GitHub Actions)
- Multi-device parallel test execution
