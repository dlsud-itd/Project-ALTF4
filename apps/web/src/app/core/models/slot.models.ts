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
