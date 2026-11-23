# Games Matchmaking Runbook

## Trade offer idempotency

`acceptTradeOffer` is idempotent for the recipient. If the receiving player accepts the same trade offer again — for example after a reconnect, a retried request, or a duplicate client event — the service returns the original, already-accepted offer unchanged instead of applying the trade a second time. Cash is therefore not moved twice: the balance and property mutations are applied only on the first successful accept, and every replay simply returns the stored offer. Note that the recipient authorization check runs before this idempotent return, so a third player can never read an accepted offer through a replay.
