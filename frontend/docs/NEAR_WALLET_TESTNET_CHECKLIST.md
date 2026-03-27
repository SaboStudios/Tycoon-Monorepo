# NEAR wallet — testnet manual checklist

Prerequisites: `NEXT_PUBLIC_NEAR_NETWORK=testnet` (default). Optional: `NEXT_PUBLIC_NEAR_CONTRACT_ID` if your app uses a contract other than the default testnet sign-in contract.

1. **Connect** — Open the app, click **Connect NEAR**, pick MyNearWallet (or another enabled wallet), complete sign-in. Expect the header to show a truncated account id.
2. **Account** — Hover or long-press the account pill; full account id should appear in the tooltip (`title`).
3. **Disconnect** — Click **Disconnect NEAR**; account pill disappears and **Connect NEAR** returns.
4. **Reject signature** — From client code or a flow that calls `callContractMethod`, cancel the wallet prompt. Expect a toast with: transaction was not signed; connect and approve to continue.
5. **Pending → confirmed** — Submit a valid contract call. Expect **Transaction pending…**, then **Confirmed**, and a **View on explorer** link.
6. **Explorer link** — Open the link; NEAR Explorer should show the transaction hash on testnet.
7. **Mobile** — Open the bottom menu; NEAR block should appear at the bottom of the sheet with **Connect NEAR** / account + disconnect.
