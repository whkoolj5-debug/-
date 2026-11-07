## 2.6.0 · Short commands and responsive actions

- `/테이블 만들기`, `/테이블 종료`, `/카드`, `/기록`, `/help`, `/족보`, `/거래 목록` — no leading 포커 command. English clients use `/table create`, `/table end`, `/hand`, `/history`, `/help`, `/rankings`, `/transactions list`. `!help` remains available.
- Acknowledge interactions immediately and queue game mutations; image rendering no longer causes normal actions to be rejected as busy. Skip overlapping background timer jobs. Modal openers respond immediately without pre-deferral.
- Private transient confirmations/errors disappear after 3 seconds; table, card sheets and interactive prompts persist.
- Move YOUR TURN and remaining time to the lower table panel. A disabled check button explains the outstanding call amount.

## 2.5.0 · 카드표와 자동 진행

- `/족보`: Royal Straight Flush 길드 족보 이미지.
- 참가/START 시 채널에 본인 전용 **내 카드표**를 엽니다. 게임이 시작되면 개인 카드가 표시되고 다음 판에도 갱신됩니다. 카드표에는 행동 버튼이 없으며 DM도 보내지 않습니다.
- Discord의 본인 전용 메시지 갱신 권한은 약 15분이며, 재시작이나 권한 만료 후에는 `/카드`로 다시 열 수 있습니다. 일반 행동을 하면 새 본인 전용 카드표로 갱신됩니다.
- 테이블 원본 3000×1950. Discord 채팅 미리보기 크기는 클라이언트 제한을 따르며, 이미지를 클릭하면 크게 볼 수 있습니다.
- 판 종료 시 별도 공용 카드 메시지와 테이블의 공용 카드를 지웁니다. 기록은 보존합니다.
- 종료 인원 조건에 도달하지 않으면 5초 후 다음 판을 자동 시작합니다.

## 테이블 종료 / Table ending

테이블 생성 후 종료 인원 1~6명을 선택합니다. 선택 인원보다 많은 참가자가 있어야 START할 수 있습니다. 판이 끝났을 때 칩이 남고 포기하지 않은 사람이 설정 인원 이하이면 테이블을 닫고 각자의 남은 칩을 잔액으로 반환합니다.

`/테이블 종료` → 방장만 사용 → 종료 확인. 진행 중인 판은 무효 처리하여 해당 판에 넣은 칩을 본인에게 돌려준 뒤 잔액으로 정산합니다. 완료된 판의 결과는 유지합니다. `/ㅈㅈ`는 명령어로 유지됩니다. 개인 카드는 채널에서 `/카드`로 본인에게만 표시됩니다. DM은 보내지 않습니다.

# RSF 포커 봇 명령어 튜토리얼

`@유저` 부분은 디스코드에서 실제 사람을 멘션해서 선택하세요.
금액은 `10000` 또는 `10,000`처럼 입력합니다. 응답은 채널에 공개됩니다.

## 먼저 한 번만 설정

1. 최신 버전을 배포하면 시작 시 Message Content 권한 자동 활성화를 시도합니다.
2. 콘솔에 `MessageContent=true`가 나오면 모든 등록된 !명령어는 멘션 없이 사용할 수 있습니다.
3. Discord가 자동 설정을 거부할 때만 Developer Portal → Bot → Message Content Intent를 켜고 재시작하세요.
4. `!help` 또는 `!tutorial`은 한국어와 영어 안내를 함께 보여줍니다. 자동 설정은 `AUTO_ENABLE_MESSAGE_CONTENT=false`로 끌 수 있습니다.

## 일반 회원

| 입력 | 결과 |
|---|---|
| `!bal` | 내 현금, 은행, 합계 잔액 |
| `!bal @유저` | 선택한 회원 잔액 |
| `!pay @유저 10000` | 내 잔액에서 10,000을 보내기 |
| `!pay @유저 all` | 내 잔액 전부 보내기 |
| `!lb` | 서버 잔액 순위 1페이지 |
| `!lb 2` | 순위 2페이지 |
| `!lb 1 -cash` | 현금 기준 순위 |
| `!lb 1 -bank` | 은행 기준 순위 |
| `!help` | 명령어 안내 |

`!balance`, `!money`는 `!bal`, `!leaderboard`는 `!lb`의 별칭입니다.
송금 별칭은 `!give-money`입니다.
송금은 현금을 먼저 쓰고 부족분을 은행에서 사용하며, 수신자에게는 현금으로 지급합니다.
잔액이 부족하면 송금되지 않습니다. 자기 자신이나 봇에게는 보낼 수 없습니다.

## 관리자

Discord의 **Administrator(관리자)** 권한이 있는 사람만 사용할 수 있습니다.
단순히 역할 이름이 ‘관리자’인 것만으로 권한을 주지 않습니다. 요청마다 최신 회원 권한을 다시 조회합니다.

| 입력 | 결과 |
|---|---|
| `!add-money @유저 10000` | 선택한 회원에게 새 돈 10,000 지급 |
| `!remove-money @유저 10000` | 선택한 회원의 합계 잔액에서 10,000 차감 |
| `!remove-money @유저 all` | 선택한 회원의 합계 잔액 전부 차감 |
| `!reset-money @유저` | 위 all과 같은 기능 |

**관리자 본인 잔액이 0이어도 !add-money은 가능합니다. 관리자 돈을 보내는 것이 아니라 새 돈을 지급합니다.**
반복 지급에 관리자 보유액 제한은 없습니다. 한 번의 명령 금액은 API 정수 범위인 1~2,147,483,647입니다.
영어 별칭은 `!add-money`, `!remove-money`입니다.
명령어는 이 봇에서 별도로 구현했습니다. 현재 UnbelievaBoat 원본 봇이 없는 서버 기준입니다. 나중에 원본 봇을 추가하면 같은 지급 명령을 양쪽에서 실행하지 않도록 접두사를 구분해야 합니다.
포커 테이블 안에 이미 들어간 칩은 지갑 잔액과 별개이며 이 명령어로 임의 회수하지 않습니다.

## 포커 진행

1. `/테이블 만들기` → 시작머니 입력
2. `/빅 스몰 설정` → 빅/스몰 확정
3. 다른 사람이 참여 버튼으로 입장 (2~7명)
4. 방장이 `/관리` → START
5. ‘내 카드 보기’로 개인 패 확인, 내 차례에 체크/콜/레이즈
6. 플롭 3장 → 턴 4장 → 리버 5장은 큰 공용 카드 이미지로 표시
7. 판이 끝나면 방장 관리에서 다음 판 시작

`/기록`은 최근 판 결과와 다시보기입니다.
`/ㅈㅈ`는 일반 폴드와 달리 남은 칩 전부를 기부하고 영구 포기합니다.
테이블이 안 보이면 권한 수정 후 방장이 `/관리` → 테이블 다시 표시를 누릅니다.

## 실제 UnbelievaBoat 잔액과 연결

기본 `ECONOMY_MODE=test`에서는 별도의 테스트 잔액을 사용합니다. 기존 테스트 잔액은 그대로 유지합니다.
실제 서버 가상화폐로 사용하려면 비공개 `.env` 또는 디스호스트 환경변수에 아래를 설정합니다.

```
ECONOMY_MODE=live
UNBELIEVABOAT_API_KEY=직접_발급한_API_키
DATABASE_PATH=data/poker-live.sqlite
```

API 키는 https://unbelievaboat.com/applications 에서 발급하고 서버 잔액 읽기/수정 권한을 허용해야 합니다.
디스코드 봇 토큰과 별도의 키입니다. 키를 채팅이나 GitHub에 올리지 마세요.
테스트 DB를 live로 재사용하지 않습니다. 테스트 게임/정산을 마친 뒤 별도 DB로 전환하세요.
이 봇이 실제 API에 연결할 수 있는지는 사용자 서버에서 별도 확인이 필요합니다.

## 거래가 확인 대기일 때 (관리자)

실제 API 송금은 출금과 입금 두 단계입니다. 외부 API 요청의 반영 여부를 모르면 자동 재시도하거나 자동 환불하지 않습니다.
이 봇 안에서는 같은 계정의 추가 지출을 막지만 원본 봇/다른 서비스의 동시 지출까지 잠글 수는 없습니다.

1. `!money-pending`: 이 봇의 중단된 송금/지급/차감 번호 확인
2. `/거래 목록`: 미확정 외부 API 쓰기 번호 확인
3. **UnbelievaBoat 거래 기록에서 실제 반영 여부 확인**
4. `/거래 확인`으로 해당 쓰기를 반영됨/미반영으로 확정
5. `!money-retry 거래번호`로 확인된 단계 이후부터 이어서 처리

모르는 상태에서 True/False를 임의로 고르지 마세요. 같은 메시지 재전송/재시작으로 중복 지급되지 않도록 거래번호를 저장합니다.
지급·차감 기록에는 실행 관리자, 대상, 금액, 상태를 저장합니다. DB는 비공개로 보관합니다.

공식 참고: https://unbelievaboat.com/commands · https://unbelievaboat.com/api/docs

## 영어 Discord 사용자

영어 클라이언트에서는 `/table create`, `/blinds setup set`, `/poker manage`, `/hand`, `/history`, `/surrender`로 표시됩니다.
한국어 클라이언트에는 기존 한국어 명령어가 그대로 표시됩니다. 잔액·송금·관리자 명령어 응답은 영어이고, `!help`는 한국어와 영어를 함께 보여줍니다.
