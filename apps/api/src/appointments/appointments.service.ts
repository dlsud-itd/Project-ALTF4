import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

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
      throw new ConflictException('This clinic slot is closed and not accepting bookings');
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
          remainingCapacity: Math.max(0, slot.capacity - slot.appointments.length - 1),
          isBookable: slot.isBookable,
        },
      },
    };
  }

  async findPatientAppointments(patientId: number) {
    const appointments = await this.prisma.appointment.findMany({
      where: { patientId },
      include: {
        slot: true,
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
}

