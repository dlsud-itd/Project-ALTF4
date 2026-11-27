import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessRole,
  AppointmentStatus,
  QueueSource,
  QueueStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueEventsService } from '../queue/queue-events.service';
import { QueueLifecycleService } from '../queue/queue-lifecycle.service';
import { isSlotPast } from '../common/is-slot-past.util';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  ACTIVE_QUEUE_STATUSES,
  DEFAULT_SERVICE_DURATION_MINUTES,
  MAX_ACTIVE_BOOKINGS,
} from '../common/clinic.constants';
import {
  estimateQueueWaitMinutes,
  getAverageServiceDurationMinutes,
} from '../common/queue-wait.util';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

const ARCHIVABLE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
];

const isActiveAppointment = (
  appointment: {
    status: AppointmentStatus;
    slot: { clinicDate: Date; endTime: string };
  },
  now: Date,
): boolean =>
  ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status) &&
  !isSlotPast(appointment.slot.clinicDate, appointment.slot.endTime, now);

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: QueueEventsService,
    private readonly queueLifecycle: QueueLifecycleService,
  ) {}

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

    if (isSlotPast(slot.clinicDate, slot.endTime)) {
      throw new ConflictException('This clinic slot has already expired');
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

    const { appointment, queueId, queueEntry, reservedQueueEntry } =
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "app_user" WHERE "id" = ${patientId} FOR UPDATE`;

        const activeAppointments = await tx.appointment.findMany({
          where: {
            patientId,
            status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          },
          select: {
            status: true,
            slot: { select: { clinicDate: true, endTime: true } },
          },
        });
        const now = new Date();
        const activeBookingCount = activeAppointments.filter((appointment) =>
          isActiveAppointment(appointment, now),
        ).length;
        if (activeBookingCount >= MAX_ACTIVE_BOOKINGS) {
          throw new ConflictException({
            code: 'MAX_ACTIVE_BOOKINGS',
            message: `You have ${activeBookingCount} active bookings out of a maximum of ${MAX_ACTIVE_BOOKINGS}. Complete or cancel an appointment before booking another.`,
          });
        }

        const duplicateSlotBooking = await tx.appointment.findFirst({
          where: {
            patientId,
            slotId: slot.id,
            status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          },
        });
        if (duplicateSlotBooking) {
          throw new ConflictException(
            'You already have an active appointment booked for this slot',
          );
        }

        const duplicateTimeBooking = await tx.appointment.findFirst({
          where: {
            patientId,
            status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
            slot: {
              clinicDate: slot.clinicDate,
              startTime: slot.startTime,
            },
          },
        });
        if (duplicateTimeBooking) {
          throw new ConflictException(
            'You already have an appointment booked at this date and time',
          );
        }

        const appointment = await tx.appointment.create({
          data: {
            patientId,
            slotId: slot.id,
            status: AppointmentStatus.BOOKED,
          },
          include: { slot: true },
        });
        const patientRecord = await tx.user.findUnique({
          where: { id: patientId },
          select: { fullName: true },
        });
        const slotDateOnly = new Date(
          `${slot.clinicDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
        );
        let dailyQueue = await tx.dailyQueue.findUnique({
          where: { clinicDate: slotDateOnly },
        });
        if (!dailyQueue) {
          dailyQueue = await tx.dailyQueue.create({
            data: {
              clinicDate: slotDateOnly,
              isOpen: true,
              nextNumber: 1,
              fallbackServiceMinutes: DEFAULT_SERVICE_DURATION_MINUTES,
            },
          });
        }
        const allocatedQueue = await tx.dailyQueue.update({
          where: { id: dailyQueue.id },
          data: { nextNumber: { increment: 1 } },
        });
        const nextNumber = allocatedQueue.nextNumber - 1;
        const ticketNumber = `A-${String(nextNumber).padStart(3, '0')}`;
        const queueEntry = await tx.queueEntry.create({
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
        await tx.queueStatusHistory.create({
          data: {
            queueEntryId: queueEntry.id,
            status: QueueStatus.WAITING,
          },
        });
        const ticketsAhead = await tx.queueEntry.count({
          where: {
            dailyQueueId: dailyQueue.id,
            status: { in: [...ACTIVE_QUEUE_STATUSES] },
            queueNumber: { lt: nextNumber },
          },
        });
        const completedTickets = await tx.queueEntry.findMany({
          where: {
            dailyQueueId: dailyQueue.id,
            status: QueueStatus.COMPLETED,
          },
          select: {
            consultationStartedAt: true,
            completedAt: true,
          },
        });
        const waitMinutes = estimateQueueWaitMinutes(
          ticketsAhead,
          getAverageServiceDurationMinutes(
            completedTickets,
            dailyQueue.fallbackServiceMinutes ??
              DEFAULT_SERVICE_DURATION_MINUTES,
          ),
        );
        return {
          appointment,
          queueId: dailyQueue.id,
          queueEntry,
          reservedQueueEntry: {
            id: queueEntry.id,
            ticketNumber,
            queueNumber: nextNumber,
            status: QueueStatus.WAITING,
            positionInQueue: ticketsAhead + 1,
            estimatedWaitMinutes: waitMinutes,
          },
        };
      });

    this.events.emit(queueId, 'queue:updated', {
      queueId,
      queueEntryId: queueEntry.id,
      ticketNumber: queueEntry.ticketNumber,
      status: QueueStatus.WAITING,
      timestamp: queueEntry.createdAt.toISOString(),
    });

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
      where:
        role === AccessRole.PATIENT
          ? { patientId: userId, archived: false }
          : {},
      select: {
        id: true,
        status: true,
        createdAt: true,
        archived: true,
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
            status: { in: [...ACTIVE_QUEUE_STATUSES] },
          },
          orderBy: [{ queueNumber: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            ticketNumber: true,
            queueNumber: true,
            status: true,
            dailyQueueId: true,
            roomNumber: true,
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
    const now = new Date();

    const activeQueueIds = new Set(
      appointments.flatMap((appointment) =>
        appointment.queueEntries.map((entry) => entry.dailyQueueId),
      ),
    );
    const completedTicketsByQueue = new Map<
      number,
      { consultationStartedAt: Date | null; completedAt: Date | null }[]
    >();
    await Promise.all(
      [...activeQueueIds].map(async (queueId) => {
        const completedTickets = await this.prisma.queueEntry.findMany({
          where: { dailyQueueId: queueId, status: QueueStatus.COMPLETED },
          select: {
            consultationStartedAt: true,
            completedAt: true,
          },
        });
        completedTicketsByQueue.set(queueId, completedTickets);
      }),
    );

    const formattedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        const isPast = isSlotPast(appt.slot.clinicDate, appt.slot.endTime, now);
        const activeEntries = isPast ? [] : appt.queueEntries;
        const reservedQueueEntries = await Promise.all(
          activeEntries.map(async (activeEntry) => {
            const ticketsAhead = await this.prisma.queueEntry.count({
              where: {
                dailyQueueId: activeEntry.dailyQueueId,
                status: { in: [...ACTIVE_QUEUE_STATUSES] },
                queueNumber: { lt: activeEntry.queueNumber },
              },
            });
            const fallbackMinutes =
              activeEntry.dailyQueue?.fallbackServiceMinutes ??
              DEFAULT_SERVICE_DURATION_MINUTES;
            return {
              id: activeEntry.id,
              ticketNumber: activeEntry.ticketNumber,
              queueNumber: activeEntry.queueNumber,
              status: activeEntry.status,
              roomNumber: activeEntry.roomNumber,
              positionInQueue: ticketsAhead + 1,
              estimatedWaitMinutes: estimateQueueWaitMinutes(
                ticketsAhead,
                getAverageServiceDurationMinutes(
                  completedTicketsByQueue.get(activeEntry.dailyQueueId) ?? [],
                  fallbackMinutes,
                ),
              ),
            };
          }),
        );

        return {
          id: appt.id,
          status: appt.status,
          createdAt: appt.createdAt,
          archived: appt.archived,
          patient: appt.patient,
          reservedQueueEntry: reservedQueueEntries[0] ?? null,
          reservedQueueEntries,
          slot: {
            id: appt.slot.id,
            clinicDate: appt.slot.clinicDate.toISOString().slice(0, 10),
            startTime: appt.slot.startTime,
            endTime: appt.slot.endTime,
            capacity: appt.slot.capacity,
            isBookable: appt.slot.isBookable,
            isExpired: isPast,
          },
        };
      }),
    );

    return {
      appointments: formattedAppointments,
      ...(role === AccessRole.PATIENT
        ? {
            activeBookingCount: appointments.filter((appointment) =>
              isActiveAppointment(appointment, now),
            ).length,
            maxActiveBookings: MAX_ACTIVE_BOOKINGS,
          }
        : {}),
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

    const cancelledAt = new Date();
    const cancelledEntries = await this.queueLifecycle.cancelAppointment(
      appointmentId,
      cancelledAt,
    );
    for (const entry of cancelledEntries) {
      this.events.emit(entry.dailyQueueId, 'queue:updated', {
        queueId: entry.dailyQueueId,
        queueEntryId: entry.id,
        ticketNumber: entry.ticketNumber,
        status: entry.status,
        cancelledAt: cancelledAt.toISOString(),
      });
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

  async archiveAppointment(patientId: number, appointmentId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { slot: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patientId !== patientId) {
      throw new ForbiddenException(
        'You are not authorized to archive this appointment',
      );
    }

    if (appointment.archived) {
      throw new BadRequestException('Appointment is already archived');
    }

    if (
      !ARCHIVABLE_APPOINTMENT_STATUSES.includes(appointment.status) ||
      !isSlotPast(appointment.slot.clinicDate, appointment.slot.endTime)
    ) {
      throw new BadRequestException(
        'Only past completed or cancelled appointments can be archived',
      );
    }

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { archived: true },
    });

    return { message: 'Appointment archived successfully' };
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

    if (isSlotPast(slot.clinicDate, slot.endTime)) {
      throw new ConflictException('This clinic slot has already expired');
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

      const slotDateOnly = new Date(
        `${slot.clinicDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
      );

      let dailyQueue = await this.prisma.dailyQueue.findFirst({
        where: { clinicDate: slotDateOnly },
      });

      if (!dailyQueue) {
        dailyQueue = await this.prisma.dailyQueue.create({
          data: {
            clinicDate: slotDateOnly,
            isOpen: true,
            nextNumber: 1,
            fallbackServiceMinutes: DEFAULT_SERVICE_DURATION_MINUTES,
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
