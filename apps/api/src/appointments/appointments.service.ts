import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, AppointmentStatus, QueueSource, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async bookAppointment(patientId: number, dto: CreateAppointmentDto) {
    const slot = await this.prisma.clinicSlot.findUnique({
      where: { id: dto.slotId },
      include: {
        appointments: {
          where: { status: AppointmentStatus.BOOKED },
        },
      },
    });

    if (!slot) {
      throw new NotFoundException('Clinic slot not found');
    }

    if (!slot.isBookable) {
      throw new ConflictException(
        'This clinic slot is closed and not accepting bookings',
      );
    }

    if (slot.appointments.length >= slot.capacity) {
      throw new ConflictException(
        'This slot is now fully booked. Please select another slot.',
      );
    }

    const hasSlotBooking = slot.appointments.some(
      (appt) => appt.patientId === patientId,
    );
    if (hasSlotBooking) {
      throw new ConflictException(
        'You already have an active appointment booked for this slot',
      );
    }

    const duplicateTime = await this.prisma.appointment.findFirst({
      where: {
        patientId,
        status: AppointmentStatus.BOOKED,
        slot: {
          clinicDate: slot.clinicDate,
          startTime: slot.startTime,
        },
      },
    });

    if (duplicateTime) {
      throw new ConflictException(
        'You already have an appointment booked at this date and time',
      );
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        patientId,
        slotId: slot.id,
        status: AppointmentStatus.BOOKED,
      },
      include: {
        slot: true,
      },
    });

    // Per Section 2 of Queue Plan: immediately assign a queue number upon booking
    let reservedQueueEntry: {
      ticketNumber: string;
      queueNumber: number;
      positionInQueue: number;
      estimatedWaitMinutes: number;
    } | null = null;

    try {
      const patientRecord = await this.prisma.user.findUnique({
        where: { id: patientId },
        select: { fullName: true },
      });

      // Find or create DailyQueue for the slot's clinic date
      const slotDateOnly = new Date(slot.clinicDate);
      slotDateOnly.setHours(0, 0, 0, 0);

      let dailyQueue = await this.prisma.dailyQueue.findFirst({
        where: {
          clinicDate: slotDateOnly,
        },
      });

      if (!dailyQueue) {
        dailyQueue = await this.prisma.dailyQueue.create({
          data: {
            clinicDate: slotDateOnly,
            isOpen: true,
            nextNumber: 1,
            fallbackServiceMinutes: 15,
          },
        });
      }

      // Atomically allocate sequential ticket number
      const allocatedQueue = await this.prisma.dailyQueue.update({
        where: { id: dailyQueue.id },
        data: { nextNumber: { increment: 1 } },
      });
      const nextNumber = allocatedQueue.nextNumber - 1;
      const ticketNumber = `A-${String(nextNumber).padStart(3, '0')}`;

      // Create QueueEntry linked to this appointment
      await this.prisma.queueEntry.create({
        data: {
          dailyQueueId: dailyQueue.id,
          patientId,
          appointmentId: appointment.id,
          queueNumber: nextNumber,
          ticketNumber,
          source: QueueSource.ONLINE,
          status: QueueStatus.WAITING,
          firstName: patientRecord?.fullName ?? 'Patient',
          reasonForVisit: dto.reasonForVisit ?? 'Scheduled Consultation',
        },
      });

      // Calculate position in queue and wait time (patients ahead * duration)
      const waitingAhead = await this.prisma.queueEntry.count({
        where: {
          dailyQueueId: dailyQueue.id,
          status: QueueStatus.WAITING,
          queueNumber: { lt: nextNumber },
        },
      });
      const positionInQueue = waitingAhead + 1;
      const estimatedWaitMinutes = waitingAhead * dailyQueue.fallbackServiceMinutes;

      reservedQueueEntry = {
        ticketNumber,
        queueNumber: nextNumber,
        positionInQueue,
        estimatedWaitMinutes,
      };
    } catch {
      // Non-blocking: if queue creation fails, booking still succeeds
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: patientId,
          action: 'APPOINTMENT_BOOKED',
          entityTable: 'appointment',
          entityId: appointment.id,
          description: dto.reasonForVisit ?? 'Patient booked appointment',
          newValues: {
            slotId: slot.id,
            clinicDate: slot.clinicDate.toISOString().slice(0, 10),
            startTime: slot.startTime,
            endTime: slot.endTime,
            reasonForVisit: dto.reasonForVisit ?? null,
          },
        },
      });
    } catch {
      // Audit log non-blocking
    }

    return {
      message: 'Appointment booked successfully',
      appointment: {
        id: appointment.id,
        status: appointment.status,
        createdAt: appointment.createdAt,
        reasonForVisit: dto.reasonForVisit ?? null,
        reservedQueueEntry,
        slot: {
          id: slot.id,
          clinicDate: slot.clinicDate.toISOString().slice(0, 10),
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          remainingCapacity: Math.max(
            0,
            slot.capacity - slot.appointments.length - 1,
          ),
          isBookable: slot.isBookable,
        },
      },
    };
  }

  async findPatientAppointments(patientId: number) {
    return this.findAppointments(patientId, AccessRole.PATIENT);
  }

  async findAppointments(userId: number, role: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: role === AccessRole.PATIENT ? { patientId: userId } : {},
      select: {
        id: true,
        status: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            fullName: true,
            affiliation: true,
          },
        },
        slot: {
          select: {
            id: true,
            clinicDate: true,
            startTime: true,
            endTime: true,
            capacity: true,
            isBookable: true,
          },
        },
        queueEntries: {
          where: {
            status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE] },
          },
          orderBy: { queueNumber: 'desc' },
          take: 1,
          select: {
            id: true,
            ticketNumber: true,
            queueNumber: true,
            status: true,
            dailyQueueId: true,
            dailyQueue: {
              select: {
                fallbackServiceMinutes: true,
              },
            },
          },
        },
      },
      orderBy: [
        { slot: { clinicDate: 'desc' } },
        { slot: { startTime: 'desc' } },
      ],
    });

    // Populate waiting counts for any linked queue entry
    const formattedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        const activeEntry = appt.queueEntries?.[0] ?? null;
        let reservedQueueEntry: {
          ticketNumber: string;
          queueNumber: number;
          positionInQueue: number;
          estimatedWaitMinutes: number;
        } | null = null;

        if (activeEntry) {
          try {
            const waitingAhead = await this.prisma.queueEntry.count({
              where: {
                dailyQueueId: activeEntry.dailyQueueId,
                status: QueueStatus.WAITING,
                queueNumber: { lt: activeEntry.queueNumber },
              },
            });
            const positionInQueue = waitingAhead + 1;
            const fallbackMin = activeEntry.dailyQueue?.fallbackServiceMinutes ?? 15;
            reservedQueueEntry = {
              ticketNumber: activeEntry.ticketNumber,
              queueNumber: activeEntry.queueNumber,
              positionInQueue,
              estimatedWaitMinutes: waitingAhead * fallbackMin,
            };
          } catch {
            reservedQueueEntry = {
              ticketNumber: activeEntry.ticketNumber,
              queueNumber: activeEntry.queueNumber,
              positionInQueue: 1,
              estimatedWaitMinutes: 0,
            };
          }
        }

        return {
          id: appt.id,
          status: appt.status,
          createdAt: appt.createdAt,
          patient: appt.patient,
          reservedQueueEntry,
          slot: {
            id: appt.slot.id,
            clinicDate: appt.slot.clinicDate.toISOString().slice(0, 10),
            startTime: appt.slot.startTime,
            endTime: appt.slot.endTime,
            capacity: appt.slot.capacity,
            isBookable: appt.slot.isBookable,
          },
        };
      }),
    );

    return {
      appointments: formattedAppointments,
    };
  }

  async findAppointment(userId: number, role: string, appointmentId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        patientId: true,
        status: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            fullName: true,
            affiliation: true,
          },
        },
        slot: {
          select: {
            id: true,
            clinicDate: true,
            startTime: true,
            endTime: true,
            capacity: true,
            isBookable: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const hasStaffAccess =
      role === AccessRole.STAFF || role === AccessRole.ADMIN;
    if (!hasStaffAccess && appointment.patientId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to view this appointment',
      );
    }

    return {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        createdAt: appointment.createdAt,
        patient: appointment.patient,
        slot: {
          id: appointment.slot.id,
          clinicDate: appointment.slot.clinicDate.toISOString().slice(0, 10),
          startTime: appointment.slot.startTime,
          endTime: appointment.slot.endTime,
          capacity: appointment.slot.capacity,
          isBookable: appointment.slot.isBookable,
        },
      },
    };
  }

  async cancelAppointment(patientId: number, appointmentId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        slot: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patientId !== patientId) {
      throw new ForbiddenException(
        'You are not authorized to cancel this appointment',
      );
    }

    if (appointment.status !== AppointmentStatus.BOOKED) {
      throw new BadRequestException(
        'Only active booked appointments can be cancelled',
      );
    }

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

    // Remove any active queue entries associated with this patient for this appointment/date
    try {
      await this.prisma.queueEntry.updateMany({
        where: {
          appointmentId,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED] },
        },
        data: {
          status: QueueStatus.CANCELLED,
        },
      });

      // Also cancel any standalone active queue entries this patient might have
      await this.prisma.queueEntry.updateMany({
        where: {
          patientId,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED] },
        },
        data: {
          status: QueueStatus.CANCELLED,
        },
      });
    } catch {
      // Non-blocking
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: patientId,
          action: 'APPOINTMENT_CANCELLED',
          entityTable: 'appointment',
          entityId: appointmentId,
          description: 'Patient cancelled consultation appointment',
        },
      });
    } catch {
      // Audit log non-blocking
    }

    return {
      message: 'Appointment cancelled successfully',
    };
  }

  async rescheduleAppointment(
    patientId: number,
    appointmentId: number,
    dto: RescheduleAppointmentDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        slot: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patientId !== patientId) {
      throw new ForbiddenException(
        'You are not authorized to reschedule this appointment',
      );
    }

    if (appointment.status !== AppointmentStatus.BOOKED) {
      throw new BadRequestException(
        'Only active booked appointments can be rescheduled',
      );
    }

    if (dto.slotId === appointment.slotId) {
      throw new BadRequestException(
        'Appointment is already booked into this slot',
      );
    }

    const slot = await this.prisma.clinicSlot.findUnique({
      where: { id: dto.slotId },
      include: {
        appointments: {
          where: { status: AppointmentStatus.BOOKED },
        },
      },
    });

    if (!slot) {
      throw new NotFoundException('Clinic slot not found');
    }

    if (!slot.isBookable) {
      throw new ConflictException(
        'This clinic slot is closed and not accepting bookings',
      );
    }

    if (slot.appointments.length >= slot.capacity) {
      throw new ConflictException(
        'This slot is now fully booked. Please select another slot.',
      );
    }

    const hasSlotBooking = slot.appointments.some(
      (appt) => appt.patientId === patientId,
    );
    if (hasSlotBooking) {
      throw new ConflictException(
        'You already have an active appointment booked for this slot',
      );
    }

    const duplicateTime = await this.prisma.appointment.findFirst({
      where: {
        id: { not: appointmentId },
        patientId,
        status: AppointmentStatus.BOOKED,
        slot: {
          clinicDate: slot.clinicDate,
          startTime: slot.startTime,
        },
      },
    });

    if (duplicateTime) {
      throw new ConflictException(
        'You already have an appointment booked at this date and time',
      );
    }

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        slotId: slot.id,
      },
    });

    // Handle linked queue entries when rescheduled:
    // Cancel the old date's queue entry, and issue a new queue entry for the new slot
    try {
      await this.prisma.queueEntry.updateMany({
        where: {
          appointmentId,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED] },
        },
        data: {
          status: QueueStatus.CANCELLED,
        },
      });

      const slotDateOnly = new Date(slot.clinicDate);
      slotDateOnly.setHours(0, 0, 0, 0);

      let dailyQueue = await this.prisma.dailyQueue.findFirst({
        where: { clinicDate: slotDateOnly },
      });

      if (!dailyQueue) {
        dailyQueue = await this.prisma.dailyQueue.create({
          data: {
            clinicDate: slotDateOnly,
            isOpen: true,
            nextNumber: 1,
            fallbackServiceMinutes: 15,
          },
        });
      }

      const allocatedQueue = await this.prisma.dailyQueue.update({
        where: { id: dailyQueue.id },
        data: { nextNumber: { increment: 1 } },
      });
      const nextNumber = allocatedQueue.nextNumber - 1;
      const ticketNumber = `A-${String(nextNumber).padStart(3, '0')}`;

      const patientRecord = await this.prisma.user.findUnique({
        where: { id: patientId },
        select: { fullName: true },
      });

      await this.prisma.queueEntry.create({
        data: {
          dailyQueueId: dailyQueue.id,
          patientId,
          appointmentId,
          queueNumber: nextNumber,
          ticketNumber,
          source: QueueSource.ONLINE,
          status: QueueStatus.WAITING,
          firstName: patientRecord?.fullName ?? 'Patient',
          reasonForVisit: 'Rescheduled Consultation',
        },
      });
    } catch {
      // Non-blocking
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: patientId,
          action: 'APPOINTMENT_RESCHEDULED',
          entityTable: 'appointment',
          entityId: appointmentId,
          description: 'Patient rescheduled consultation appointment',
          oldValues: {
            slotId: appointment.slotId,
            clinicDate: appointment.slot.clinicDate.toISOString().slice(0, 10),
            startTime: appointment.slot.startTime,
            endTime: appointment.slot.endTime,
          },
          newValues: {
            slotId: slot.id,
            clinicDate: slot.clinicDate.toISOString().slice(0, 10),
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        },
      });
    } catch {
      // Audit log non-blocking
    }

    return {
      message: 'Appointment rescheduled successfully',
      appointment: {
        id: appointmentId,
        status: appointment.status,
        slot: {
          id: slot.id,
          clinicDate: slot.clinicDate.toISOString().slice(0, 10),
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          remainingCapacity: Math.max(
            0,
            slot.capacity - slot.appointments.length - 1,
          ),
          isBookable: slot.isBookable,
        },
      },
    };
  }
}
