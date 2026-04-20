export type ReservationStatus = "active" | "allocated" | "expired" | "cancelled";

export type InventorySku = {
  sku: string;
  editionCeiling: number;
  allocatedCount: number;
};

export type InventoryReservation = {
  id: string;
  sku: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
};

export type InventoryState = {
  skus: Record<string, InventorySku>;
  reservations: Record<string, InventoryReservation>;
};

export type ReservationResult =
  | {
      ok: true;
      state: InventoryState;
      reservation: InventoryReservation;
      availableAfter: number;
    }
  | {
      ok: false;
      state: InventoryState;
      reason: "sku_not_found" | "quantity_invalid" | "insufficient_inventory";
      availableAfter: number;
    };

export function createLocal001Inventory(): InventoryState {
  return {
    skus: {
      "AO-001-BLACK-S": { sku: "AO-001-BLACK-S", editionCeiling: 20, allocatedCount: 0 },
      "AO-001-BLACK-M": { sku: "AO-001-BLACK-M", editionCeiling: 20, allocatedCount: 0 },
      "AO-001-BLACK-L": { sku: "AO-001-BLACK-L", editionCeiling: 20, allocatedCount: 0 },
      "AO-001-BLACK-XL": { sku: "AO-001-BLACK-XL", editionCeiling: 20, allocatedCount: 0 },
      "AO-001-BLACK-XXL": { sku: "AO-001-BLACK-XXL", editionCeiling: 20, allocatedCount: 0 },
    },
    reservations: {},
  };
}

export function activeReservedCount(state: InventoryState, sku: string, now: Date): number {
  return Object.values(state.reservations).reduce((total, reservation) => {
    if (reservation.sku !== sku) {
      return total;
    }

    if (reservation.status !== "active") {
      return total;
    }

    if (reservation.expiresAt <= now) {
      return total;
    }

    return total + reservation.quantity;
  }, 0);
}

export function availableCount(state: InventoryState, sku: string, now: Date): number {
  const inventorySku = state.skus[sku];

  if (!inventorySku) {
    return 0;
  }

  return inventorySku.editionCeiling - inventorySku.allocatedCount - activeReservedCount(state, sku, now);
}

export function expireReservations(state: InventoryState, now: Date): InventoryState {
  const reservations: Record<string, InventoryReservation> = Object.fromEntries(
    Object.entries(state.reservations).map(([id, reservation]) => {
      if (reservation.status === "active" && reservation.expiresAt <= now) {
        return [id, { ...reservation, status: "expired" as const }];
      }

      return [id, reservation];
    }),
  );

  return { ...state, reservations };
}

export function tryReserveInventory(
  state: InventoryState,
  input: {
    reservationId: string;
    sku: string;
    quantity: number;
    now: Date;
    expiresAt: Date;
  },
): ReservationResult {
  const expiredState = expireReservations(state, input.now);
  const inventorySku = expiredState.skus[input.sku];

  if (!inventorySku) {
    return { ok: false, state: expiredState, reason: "sku_not_found", availableAfter: 0 };
  }

  if (input.quantity <= 0) {
    return {
      ok: false,
      state: expiredState,
      reason: "quantity_invalid",
      availableAfter: availableCount(expiredState, input.sku, input.now),
    };
  }

  const available = availableCount(expiredState, input.sku, input.now);

  if (available < input.quantity) {
    return {
      ok: false,
      state: expiredState,
      reason: "insufficient_inventory",
      availableAfter: available,
    };
  }

  const reservation: InventoryReservation = {
    id: input.reservationId,
    sku: input.sku,
    quantity: input.quantity,
    status: "active",
    expiresAt: input.expiresAt,
  };

  const nextState = {
    ...expiredState,
    reservations: {
      ...expiredState.reservations,
      [reservation.id]: reservation,
    },
  };

  return {
    ok: true,
    state: nextState,
    reservation,
    availableAfter: availableCount(nextState, input.sku, input.now),
  };
}

export function allocateReservation(state: InventoryState, reservationId: string, now: Date): InventoryState {
  const expiredState = expireReservations(state, now);
  const reservation = expiredState.reservations[reservationId];

  if (!reservation || reservation.status !== "active" || reservation.expiresAt <= now) {
    return expiredState;
  }

  const sku = expiredState.skus[reservation.sku];

  if (!sku) {
    return expiredState;
  }

  return {
    skus: {
      ...expiredState.skus,
      [sku.sku]: {
        ...sku,
        allocatedCount: sku.allocatedCount + reservation.quantity,
      },
    },
    reservations: {
      ...expiredState.reservations,
      [reservationId]: {
        ...reservation,
        status: "allocated",
      },
    },
  };
}
