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
| `!help` or `!tutorial` | Shows the tutorial in Discord. |

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

1. `/poker table create` — Create a table and enter starting chips.
2. `/blinds setup set` — The host confirms big/small blinds.
3. Players join using the table button. **2–7 players can start.**
4. `/poker manage` — The host presses START.
5. `/poker hand` — View your private cards. Bet only on your turn.
6. The flop, turn and river appear as public card images. Unrevealed cards stay hidden.
7. The host starts the next hand from the management panel.

`/poker history` opens recent hand results and replay. `/surrender` permanently forfeits all remaining chips and differs from a normal fold.
Korean Discord clients retain the existing Korean slash-command labels.

## One-time message setup

Enable **Developer Portal → your application → Bot → Privileged Gateway Intents → Message Content Intent**, then restart the bot.
Before it is enabled, mention the bot before the command: `@RSF POKER BOT !bal`.
The bot checks whether the intent is enabled and avoids requesting a forbidden privileged intent, so the poker bot can remain online.
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

1. Use `/poker-transactions list` (Korean: `/포커거래 목록`) to find uncertain writes.
2. Check the actual UnbelievaBoat transaction/audit records.
3. Use `/poker-transactions confirm` (`/포커거래 확인`) to mark the write applied or not applied.
4. Use `!money-retry transaction-id` to resume only the remaining confirmed steps.

Do not guess the applied status. Uncertain writes freeze additional money changes involving those accounts in this bot.
Other bots and external services do not share this lock. Local TEST transfers are atomic SQLite transactions.
Command IDs, administrator/sender, recipient, amount and state are persisted. Keep the database private.

Official references: https://unbelievaboat.com/commands and https://unbelievaboat.com/api/docs
