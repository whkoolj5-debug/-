## 2.6.0 · Short commands and responsive actions

- `/테이블 만들기`, `/테이블 종료`, `/카드`, `/기록`, `/help`, `/족보`, `/거래 목록` — no leading 포커 command. English clients use `/table create`, `/table end`, `/hand`, `/history`, `/help`, `/rankings`, `/transactions list`. `!help` remains available.
- Acknowledge interactions immediately and queue game mutations; image rendering no longer causes normal actions to be rejected as busy. Skip overlapping background timer jobs. Modal openers respond immediately without pre-deferral.
- Private transient confirmations/errors disappear after 3 seconds; table, card sheets and interactive prompts persist.
- Move YOUR TURN and remaining time to the lower table panel. A disabled check button explains the outstanding call amount.

## 테이블 종료 / Table ending

테이블 생성 후 종료 인원 1~6명을 선택합니다. 선택 인원보다 많은 참가자가 있어야 START할 수 있습니다. 판이 끝났을 때 칩이 남고 포기하지 않은 사람이 설정 인원 이하이면 테이블을 닫고 각자의 남은 칩을 잔액으로 반환합니다.

`/테이블 종료` → 방장만 사용 → 종료 확인. 진행 중인 판은 무효 처리하여 해당 판에 넣은 칩을 본인에게 돌려준 뒤 잔액으로 정산합니다. 완료된 판의 결과는 유지합니다. `/ㅈㅈ`는 명령어로 유지됩니다. 개인 카드는 채널에서 `/카드`로 본인에게만 표시됩니다. DM은 보내지 않습니다.

# RSF Poker Bot — Command Tutorial

Use a real Discord member mention wherever you see `@member`. Amounts accept `10000` or `10,000`.

## Everyone

| Type this | What happens |
|---|---|
| `!bal` | Shows your cash, bank and total balance. |
| `!bal @member` | Shows that member's balance. |
| `!pay @member 10000` | Sends 10,000 from your wallet; cash first, then bank. |
| `!pay @member all` | Sends your entire available wallet balance. |
| `!lb` | Shows the server's total-balance leaderboard. |
| `!lb 2` | Shows page 2. |
| `!lb 1 -cash` | Ranks by cash. Use `-bank` or `-total` for other balances. |
| `!help` or `!tutorial` | Shows Korean and English tutorials together in Discord. |

Aliases: `!balance`, `!money` = `!bal`; `!give-money` = `!pay`; `!leaderboard` = `!lb`.
Responses are public in the channel. Bots, webhooks, DMs and other servers are ignored.

## Administrators

These commands require Discord **Administrator permission**, checked against the member's current permissions.
A role merely named “Admin” does not grant access.

| Type this | What happens |
|---|---|
| `!add-money @member 10000` | Issues 10,000 NEW funds to that member's cash balance. |
| `!remove-money @member 10000` | Deducts 10,000 from that member's cash + bank total. |
| `!remove-money @member all` | Removes their entire positive wallet balance. |
| `!reset-money @member` | Same as the previous command. `!clear-money` is an alias. |

**Administrators can issue funds even with a balance of 0. Their own balance is never charged.**
There is no administrator funding requirement or lifetime issuance allowance. Each command accepts 1–2,147,483,647, the API integer limit.
Wallet changes do not confiscate chips already committed to a poker table.
The server currently does not have the original UnbelievaBoat bot. If it is added later, use different prefixes to avoid processing grants twice.

## Poker

English Discord clients show localized command names:

1. `/table create` — Create a table and enter starting chips.
2. `/blinds setup set` — The host confirms big/small blinds.
3. Players join using the table button. **2–7 players can start.**
4. `/poker manage` — The host presses START.
5. `/hand` — View your private cards. Bet only on your turn.
6. The flop, turn and river appear as public card images. Unrevealed cards stay hidden.
7. The host starts the next hand from the management panel.

`/history` opens recent hand results and replay. `/surrender` permanently forfeits all remaining chips and differs from a normal fold.
Korean Discord clients retain the existing Korean slash-command labels.

## One-time message setup

On startup, the bot uses Discord’s documented application API to enable the supported limited Message Content flag for small bots. After the console shows `MessageContent=true`, all registered ! commands work without a mention.
If Discord rejects the change, enable **Developer Portal → your application → Bot → Message Content Intent** and restart. Until then, mention the bot before the command.
Set `AUTO_ENABLE_MESSAGE_CONTENT=false` to opt out of automatic application changes. Existing presence/member limited settings are preserved; no other settings are changed. Applications at verified scale still need Discord approval.
`!help` sends Korean and English together.
The old `/포커 잔액` slash subcommand is removed on the next successful command sync; the other poker commands remain.

## TEST versus LIVE balances

The default is `ECONOMY_MODE=test`: independent test wallets, initially 5,000,000. Existing test funds are preserved.
For actual UnbelievaBoat server currency, configure a separate private environment:

```dotenv
ECONOMY_MODE=live
UNBELIEVABOAT_API_KEY=YOUR_PRIVATE_API_KEY
DATABASE_PATH=data/poker-live.sqlite
```

Obtain the API key at https://unbelievaboat.com/applications and authorize balance read/write access for your guild.
It is separate from the Discord bot token. Never post either key in chat or GitHub. Do not switch a test database to live mode.
No live credentials are included, and real API writes must be verified in the user's server.

## Interrupted payments — administrators

`!money-pending` lists durable command intents. `!money-retry transaction-id` resumes a reviewed request.
LIVE payments have a debit step and a credit step; the public API does not provide an atomic cross-user transfer through these endpoints.
If a response is lost, this bot does not automatically retry the write or refund the sender, because doing so could duplicate money.

1. Use `/transactions list` (Korean: `/거래 목록`) to find uncertain writes.
2. Check the actual UnbelievaBoat transaction/audit records.
3. Use `/transactions confirm` (`/거래 확인`) to mark the write applied or not applied.
4. Use `!money-retry transaction-id` to resume only the remaining confirmed steps.

Do not guess the applied status. Uncertain writes freeze additional money changes involving those accounts in this bot.
Other bots and external services do not share this lock. Local TEST transfers are atomic SQLite transactions.
Command IDs, administrator/sender, recipient, amount and state are persisted. Keep the database private.

Official references: https://unbelievaboat.com/commands and https://unbelievaboat.com/api/docs
