# Approval Ledger

This ledger records non-secret approval metadata. Source screenshots, Discord message IDs, and private channel exports remain outside Git unless explicitly approved.

## AO-APPROVAL-0001

- Date: 2026-04-19
- Channel: Discord `#approvals`
- Approver: `hamzacodesfast`
- Scope: token work freeze until after commerce launch
- Decision: approved

Approved text:

```text
Token work is frozen until after commerce launch.
No token ownership, profit, governance, dividend, revenue-share, entitlement, price, or market language may be published.
```

Operational effect:

- Token, wallet, investment-adjacent, and market-adjacent public statements remain blocked.
- Commerce launch remains the critical path.
- Livestream/token work may not begin until the production commerce gate is complete and a later approval supersedes this one.

## AO-APPROVAL-0002

- Date: 2026-04-20
- UTC timestamp: 2026-04-20T09:39:23Z
- Channel: Codex operator chat
- Approver: `hamzacodesfast`
- Scope: public policy and contact text for Gate 1
- Local number: `001`
- Decision: approved

Material reviewed:

- Shipping policy page: `app/shipping/page.tsx`
- Returns policy page: `app/returns/page.tsx`
- Privacy policy page: `app/privacy/page.tsx`
- Terms page: `app/terms/page.tsx`
- Contact page: `app/contact/page.tsx`

Operational effect:

- Gate 1 policy text is human-approved.
- Public policy/contact pages may remain in the launch candidate.
- Live checkout still requires later production proof, shipping/tax validation, and live checkout rehearsal approvals.

## AO-APPROVAL-0003

- Date: 2026-04-20
- UTC timestamp: 2026-04-20T09:58:56Z
- Channel: Codex operator chat
- Approver: `hamzacodesfast`
- Scope: Local No. 001 physical sample / production proof
- Local number: `001`
- Asset/object IDs:
  - Printify product ID: `69e5bbbbc109d487ac09e911`
  - Production file checksum: `sha256:7f0327d5781fa57838748c0ad8b351f529b97a9388811391fdd86cadeaa7bb8c`
  - Printify back mockup checksum: `sha256:67a97cbe124b6a5f2fdda9b8c5e5f55271f61f3de72a2b566a01899ebc7cc35a`
- Decision: approved

Material reviewed:

- Physical sample or production proof for Local No. 001
- Back-only print placement
- Black Gildan 5000 blank
- Printify draft product and mockup record

Operational effect:

- Local No. 001 physical sample / production proof is human-approved.
- The production file, Printify draft, and mockup may proceed to shipping/tax validation.
- Live checkout still requires shipping/tax confirmation and live checkout rehearsal approval.

## AO-APPROVAL-0004

- Date: 2026-04-20
- UTC timestamp: 2026-04-20T10:06:36Z
- Channel: Codex operator chat
- Approver: `hamzacodesfast`
- Scope: Local No. 001 shipping profile and tax behavior for launch rehearsal
- Local number: `001`
- Decision: approved

Approved operating decision:

- Shipping is included in the listed $50 USD retail price for countries available at checkout.
- Fulfillment is handled through Printify after paid allocation.
- Separate Stripe automatic tax collection is not being enabled before live checkout rehearsal.
- The human operator accepts responsibility for accounting and tax treatment outside the app workflow.

Operational effect:

- Gate 2 shipping profile and tax behavior confirmation is complete.
- Local No. 001 may proceed to live checkout rehearsal preparation.
- `PRINTIFY_ENABLED` remains false until live fulfillment is separately approved for the rehearsal purchase.
