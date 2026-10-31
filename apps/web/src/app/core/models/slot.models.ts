export type ClinicSlot = {
  id: number;
  clinicDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remainingCapacity: number;
  isBookable: boolean;
};

export type SlotsResponse = {
  slots: ClinicSlot[];
};

// Display status of a slot, derived from capacity and bookability.
export type SlotStatus = 'open' | 'full' | 'closed';

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
