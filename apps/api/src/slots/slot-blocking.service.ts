import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationRecipientRole } from '../notifications/notification-events';
import { isSlotPast } from '../common/is-slot-past.util';
import { toUtcDate } from './slot-date.util';

// Blocks or reopens one slot and notifies any patient holding a BOOKED
// appointment in it. The appointment keeps its status; staff resolve the
// move manually, matching the notification-only policy.
@Injectable()
export class SlotBlockingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async setSlotBlocked(slotId: number, isBlocked: boolean) {
    const slot = await this.prisma.clinicSlot.findUnique({
      where: { id: slotId },
      include: {
        appointments: {
          where: { status: AppointmentStatus.BOOKED },
          select: { id: true, patientId: true },
        },
      },
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    if (isSlotPast(slot.clinicDate, slot.endTime)) {
      throw new BadRequestException('This slot has already ended');
    }

    await this.prisma.clinicSlot.update({
      where: { id: slotId },
      data: { isBookable: !isBlocked },
    });

    const notified = isBlocked ? await this.notifyAffectedPatients(slot) : 0;

    return {
      message: isBlocked
        ? 'Slot blocked successfully'
        : 'Slot reopened successfully',
      slotId,
      affectedAppointments: slot.appointments.length,
      notificationsSent: notified,
    };
  }

  // Applies the block to every upcoming slot on a clinic date so a full-day
  // closure is a single action. Past slots are left untouched so the schedule
  // keeps an accurate record of what already happened. Returns counts so the
  // UI can report what changed.
  async setDayBlocked(clinicDate: string, isBlocked: boolean) {
    const date = toUtcDate(clinicDate, 'clinicDate');

    const allSlots = await this.prisma.clinicSlot.findMany({
      where: { clinicDate: date },
      include: {
        appointments: {
          where: { status: AppointmentStatus.BOOKED },
          select: { id: true, patientId: true },
        },
      },
    });

    if (allSlots.length === 0) {
      throw new NotFoundException('No slots found for that date');
    }

    const slots = allSlots.filter(
      (slot) => !isSlotPast(slot.clinicDate, slot.endTime),
    );

    if (slots.length === 0) {
      throw new BadRequestException(
        'Every slot on that date has already ended',
      );
    }

    await this.prisma.clinicSlot.updateMany({
      where: { id: { in: slots.map((slot) => slot.id) } },
      data: { isBookable: !isBlocked },
    });

    let notified = 0;
    if (isBlocked) {
      for (const slot of slots) {
        notified += await this.notifyAffectedPatients(slot);
      }
    }

    return {
      message: isBlocked
        ? 'All upcoming slots for the day blocked successfully'
        : 'All upcoming slots for the day reopened successfully',
      clinicDate,
      slotsAffected: slots.length,
      pastSlotsSkipped: allSlots.length - slots.length,
      notificationsSent: notified,
    };
  }

  // Sends one reschedule notification per booked appointment in the slot.
  private async notifyAffectedPatients(slot: {
    id: number;
    clinicDate: Date;
    startTime: string;
    appointments: { id: number; patientId: number }[];
  }): Promise<number> {
    if (slot.appointments.length === 0) {
      return 0;
    }

    const appointmentDate = slot.clinicDate.toISOString().slice(0, 10);
    let sent = 0;

    for (const appointment of slot.appointments) {
      sent += await this.notifications.createForRecipients(
        {
          type: NotificationType.BOOKING_RESCHEDULE,
          context: {
            appointmentId: appointment.id,
            appointmentDate,
            appointmentTime: slot.startTime,
          },
        },
        {
          [NotificationRecipientRole.PATIENT]: [appointment.patientId],
          [NotificationRecipientRole.STAFF]: [],
        },
      );
    }

    return sent;
  }
}
