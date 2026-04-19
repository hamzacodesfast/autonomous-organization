import assert from "node:assert/strict";
import {
  allocateReservation,
  availableCount,
  createLocal001Inventory,
  expireReservations,
  tryReserveInventory,
} from "../../lib/inventory";

const now = new Date("2026-04-19T16:00:00.000Z");
const expiresAt = new Date("2026-04-19T16:15:00.000Z");
const sku = "AO-001-BLACK-XL";

let state = createLocal001Inventory();
let successes = 0;
let failures = 0;

for (let index = 0; index < 50; index += 1) {
  const result = tryReserveInventory(state, {
    reservationId: `test-reservation-${index}`,
    sku,
    quantity: 1,
    now,
    expiresAt,
  });

  state = result.state;

  if (result.ok) {
    successes += 1;
  } else {
    failures += 1;
  }
}

assert.equal(successes, 10);
assert.equal(failures, 40);
assert.equal(availableCount(state, sku, now), 0);

state = allocateReservation(state, "test-reservation-0", now);
assert.equal(state.skus[sku]?.allocatedCount, 1);

const afterExpiry = new Date("2026-04-19T16:16:00.000Z");
state = expireReservations(state, afterExpiry);

assert.equal(availableCount(state, sku, afterExpiry), 9);

console.log("inventory reservation tests passed");
