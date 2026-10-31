import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, AppointmentStatus } from '@prisma/client';
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
      },
      orderBy: [
        { slot: { clinicDate: 'desc' } },
        { slot: { startTime: 'desc' } },
      ],
    });

    return {
      appointments: appointments.map((appt) => ({
        id: appt.id,
        status: appt.status,
        createdAt: appt.createdAt,
        patient: appt.patient,
        slot: {
          id: appt.slot.id,
          clinicDate: appt.slot.clinicDate.toISOString().slice(0, 10),
          startTime: appt.slot.startTime,
          endTime: appt.slot.endTime,
          capacity: appt.slot.capacity,
          isBookable: appt.slot.isBookable,
        },
      })),
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
