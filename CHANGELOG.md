## 2.5.1 · Host dependency recovery

- Keep src/index.js as a dependency-free startup wrapper.
- Probe discord.js and an actual sharp render before loading the bot. If broken or missing, run one lockfile-based npm ci with optional native packages, then verify again.
- Skip lifecycle scripts, preserve .env and data, and use a writable temporary npm cache.
- Support Node >=22.13, including DisHost Node 22.

## 2.5.0 · 카드표와 자동 진행

- `/족보`: Royal Straight Flush 길드 족보 이미지.
- 참가/START 시 채널에 본인 전용 **내 카드표**를 엽니다. 게임이 시작되면 개인 카드가 표시되고 다음 판에도 갱신됩니다. 카드표에는 행동 버튼이 없으며 DM도 보내지 않습니다.
- Discord의 본인 전용 메시지 갱신 권한은 약 15분이며, 재시작이나 권한 만료 후에는 `/포커 카드`로 다시 열 수 있습니다. 일반 행동을 하면 새 본인 전용 카드표로 갱신됩니다.
- 테이블 원본 3000×1950. Discord 채팅 미리보기 크기는 클라이언트 제한을 따르며, 이미지를 클릭하면 크게 볼 수 있습니다.
- 판 종료 시 별도 공용 카드 메시지와 테이블의 공용 카드를 지웁니다. 기록은 보존합니다.
- 종료 인원 조건에 도달하지 않으면 5초 후 다음 판을 자동 시작합니다.

# 2.4.0

- Ask host for a survivor threshold on table creation; allow lobby changes.
- Settle each player’s remaining chips after a completed hand reaches the threshold.
- Add owner-only /테이블 종료 with confirmation and stale-state checks. Void an unfinished hand and return its commitments before idempotent settlement.
- Automatically refresh guild slash commands on startup.

# Table button cleanup

- Remove card/history/surrender/theme/refresh buttons from the shared table; keep /포커 카드, /포커 기록 and /ㅈㅈ commands.

# 2.3.1

- Remove automatic DMs. Private cards are shown ephemerally in the game channel through /포커 카드.
- Public community cards and turn notices remain shared in the game channel.

# 2.3.0

- Large 1800×1170 public table with explicit SMALL BLIND / BIG BLIND amounts.
- Public host controls and START (2–7 players); owner authorization remains enforced.
- Automatic private card DMs and turn reminders; private card button fallback.
- Large YOUR TURN and remaining time; image refresh every 10 seconds.
- Separate public community-card image, updated on flop/turn/river.
- Public interaction errors never overwrite the shared table.

# 2.2.4 — Remove dotenv startup dependency

- Replace dotenv/config imports in bot startup, config check and command registration with Node's built-in loadEnvFile.
- Remove dotenv from package.json and package-lock.json; verify clean npm ci succeeds with dotenv absent.
- Preserve host-provided environment values, support quoted .env values/comments, and allow a missing .env when the host injects configuration.
- Surface unexpected file errors without printing configuration contents.
- 84 automated tests pass.

# 2.2.3 — Plain prefix commands and bilingual help

- Enable the supported Message Content limited application flag through Discord's documented /applications/@me API on startup, before gateway login.
- Preserve other limited flags, skip already-enabled or verified-scale applications, and safely retain mention commands/poker if the API denies the change.
- All registered ! commands can work without a bot mention when the setting is enabled.
- AUTO_ENABLE_MESSAGE_CONTENT=false explicitly disables automatic setting changes.
- !help / !tutorial / !도움말 show Korean and English guides in the same reply, within Discord's total embed text limits.
- 80 tests pass, including supported-flag updates, rejection, real-client subscriptions and bilingual response limits.

# 2.2.2 — Fix message event subscriptions

- discord.js freezes Client.options.intents. BitField.add() returns a new object for a frozen field; the old code ignored that return value.
- Subscribe to GuildMessages when constructing the client and reassign the updated frozen bitfield before gateway login.
- Reassign MessageContent only when the application has enabled it. Bot mentions still work without that privileged intent.
- Log the effective GuildMessages/MessageContent subscription values.
- Reproduce the bug and verify the fix with real discord.js Client objects instead of only mutable test doubles.
- 74 automated tests pass.

# 2.2.1 — Fix duplicate navigation component IDs

- History previous/next buttons have unique IDs even when there is only one saved hand.
- Replay first/previous/next/result buttons remain unique when they target the same boundary step.
- Keep existing replay/history routes compatible by adding an action suffix.
- Validate Discord message-wide ID uniqueness in integration mocks, including disabled buttons.
- Check history lists of 1–10 hands and replay timelines of 1–30 steps.
- Include the actual package version in Ready and health output so a stale host deployment is visible.
- 72 automated tests pass.

# 2.2.0 — English economy commands and tutorials

- Replace the balance slash subcommand with !bal; add !balance/!money aliases.
- Add !pay/!give-money transfers and !lb/!leaderboard.
- Administrator-only !add-money creates funds without charging the issuer, even with 0 balance.
- Administrator-only !remove-money and !reset-money/!clear-money deduct a target wallet.
- Revalidate current Administrator permissions before money mutations; do not trust a role name or cached membership.
- English responses and !help/!tutorial; English slash-command name/description localization.
- Detect Message Content permission before requesting the privileged intent. Mention-based fallback keeps the bot usable while disabled.
- Synchronize the new slash-command schema once on ready; old balance interactions point to !bal.
- Atomic local wallet transfers, persistent command intents, duplicate-event protection, paused uncertain LIVE API writes and administrator-assisted recovery.
- TEST balances remain independent from UnbelievaBoat LIVE balances. No credentials or financial data are included.
- 68 automated tests pass, including zero-balance issuance, unauthorized requests, partial API failure/restart, rollback and numeric bounds.

# 2.1.2 — 공용 카드 이미지와 2인 시작

- 2~7명 시작 가능. 2인전 딜러/블라인드/턴 순서를 검증했습니다.
- 공개된 공용 카드만 별도 큰 PNG와 임베드로 표시합니다.
- 이미지 갱신마다 고유 파일명을 사용해 첨부 캐시가 이전 테이블을 가리키지 않도록 했습니다.
- 플롭 3장, 턴 4장, 리버 5장을 실제 카드 PNG와 픽셀 비교하고 공개 전에는 보이지 않는지 검사합니다.
- 전체 49개 테스트 통과.

# 2.1.1 — 채널 접근 오류와 테이블 복구

- 참가비 처리 전에 채널 보기/메시지 전송/기록 보기/이미지 첨부/임베드 권한을 확인합니다.
- Missing Access/Missing Permissions 오류에 채널 권한 수정 방법을 표시합니다.
- 방장 관리 화면에 ‘테이블 다시 표시’를 추가했습니다.
- 공개 메시지 전송이 실패한 기존 테이블은 중복 참가비 없이 복구합니다.
- Discord 서버의 권한을 코드가 자동으로 변경하지 않습니다. 채널 권한은 서버 관리자가 허용해야 합니다.
- 관련 실패/복구 테스트 3개 추가. 전체 46개 통과.

# 2.1.0 — RSF Poker Club

Poker Now의 테이블 중심 진행과 판 기록 경험을 참고해 디스코드용으로 자체 구현했습니다.
Poker Now의 코드, 로고, 테이블 이미지 또는 계정을 사용하지 않습니다.

- 1200×780 테이블: 펠트 질감, 딜러/SB/BB 배지, 좌석 번호, 차례 강조, 칩과 베팅액, 공용 카드, 승자 강조.
- 에메랄드 / 미드나이트 / 버건디 테마. 방장 관리 패널에서 변경하고 재시작 후에도 유지.
- 정확한 콜 금액, 최소 레이즈, 내 최대 총액과 상대적인 마감 시간 표시.
- 최소 / ½ 팟 / 팟 빠른 베팅. 콜 후 팟을 기준으로 계산하며 불가능한 선택과 중복 금액은 숨김.
- 짧은 올인으로 레이즈 권한이 열리지 않은 상황도 서버의 기존 게임 규칙으로 재검증.
- 내 카드 화면에 현재 내 족보와 내 차례의 행동 버튼 표시. 개인 응답 유지.
- `/포커 기록` 및 판 번호 선택, 이전/다음 판, 공용 기록 JSON 내려받기.
- 최근 10판, 판별 최대 200개 행동, 각 행동의 공용 테이블 상태를 SQLite에 보관.
- 판 다시보기: 처음/이전 행동/다음 행동/결과 이동. 실제 게임 상태나 잔액을 변경하지 않음.
- 쇼다운에서는 폴드하지 않은 참가자의 패와 족보 공개. 전원 폴드 승리는 패를 공개하지 않음.
- 수령액과 순증감을 구분. 판별 순증감 합계는 0.
- `/포커 도움말`, Windows 설치/시작/미리보기 실행 파일 추가.
- 이전 판에서 열린 개인 버튼이 새 판에 사용되지 않도록 판 사이 revision을 이어감.
- Discord 연결이 준비되지 않으면 자동 행동을 실행하지 않음. 종료 시 처리 중인 작업을 기다림.
- sharp 0.35.5로 업데이트. 이미지 작업 병렬도와 캐시 사용량을 제한.
- 기존 경제 모드/참가비/환불/사이드팟/포기/중복 정산 방지/거래 수동 확인 유지.

## 호환성

Node.js 24 이상. 기존 DB 스키마 변경 없이 이전 게임을 읽습니다.
이전 판에 저장되지 않은 행동 기록은 복원할 수 없습니다. 다시보기는 기록된 단계부터 제공됩니다.
진행 중인 판이 있다면 종료하거나 봇을 정상 종료한 뒤 업데이트하고 같은 DB로 재시작하세요.
기존 `.env`와 `data/`를 덮어쓰지 마세요. GitHub에는 토큰과 DB를 올리지 않습니다.
