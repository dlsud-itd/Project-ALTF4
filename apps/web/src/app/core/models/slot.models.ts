export type ClinicSlot = {
  id: number;
  clinicDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remainingCapacity: number;
  isBookable: boolean;
  isExpired?: boolean;
  // Stored open/closed flag without the "full" and "past" adjustments, so the
  // staff list can tell a closed slot from a full one.
  isOpen?: boolean;
};

export type SlotsResponse = {
  slots: ClinicSlot[];
};

// Display status of a slot, derived from capacity and bookability.
export type SlotStatus = 'open' | 'full' | 'closed' | 'expired';

// Values the staff slot form produces; matches the CreateSlotDto fields.
export type SlotFormValue = {
  clinicDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  isBookable: boolean;
};

// Body returned by POST /slots (with id) and PATCH /slots/:id.
export type SlotMutationResponse = {
  message: string;
  id?: number;
};

// Body for PATCH /slots/:id/block and POST /slots/block-day; the reason is
// accepted as a placeholder for future audit logging but is not persisted yet.
export type BlockSlotValue = {
  isBlocked: boolean;
  reason?: string;
};

export type BlockDayValue = BlockSlotValue & {
  clinicDate: string;
};

// Result of blocking or reopening slots.
export type BlockSlotResponse = {
  message: string;
  slotId: number;
  affectedAppointments: number;
  notificationsSent: number;
};

export type BlockDayResponse = {
  message: string;
  clinicDate: string;
  slotsAffected: number;
  pastSlotsSkipped: number;
  notificationsSent: number;
};
