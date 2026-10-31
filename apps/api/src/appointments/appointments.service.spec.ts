import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  const mockPrismaService = {
    clinicSlot: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    appointment: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    auditLog: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };

  beforeEach(async () => {
    Object.values(mockPrismaService.clinicSlot).forEach((mock) =>
      mock.mockReset(),
    );
    Object.values(mockPrismaService.appointment).forEach((mock) =>
      mock.mockReset(),
    );
    Object.values(mockPrismaService.auditLog).forEach((mock) =>
      mock.mockReset(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('bookAppointment', () => {
    const patientId = 101;
    const dto: CreateAppointmentDto = {
      slotId: 10,
      reasonForVisit: 'General checkup',
    };

    it('successfully books into an available slot', async () => {
      mockPrismaService.clinicSlot.findUnique.mockResolvedValue({
        id: 10,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '09:00',
        endTime: '09:30',
        capacity: 2,
        isBookable: true,
        appointments: [],
      });
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);
      mockPrismaService.appointment.create.mockResolvedValue({
        id: 50,
        patientId,
        slotId: 10,
        status: AppointmentStatus.BOOKED,
        createdAt: new Date('2026-10-31T00:00:00.000Z'),
      });
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 1 });

      const result = await service.bookAppointment(patientId, dto);

      expect(result.message).toBe('Appointment booked successfully');
      expect(result.appointment.id).toBe(50);
      expect(result.appointment.slot.remainingCapacity).toBe(1);
      expect(mockPrismaService.appointment.create).toHaveBeenCalledWith({
        data: {
          patientId,
          slotId: 10,
          status: AppointmentStatus.BOOKED,
        },
        include: { slot: true },
      });
    });

    it('rejects booking when slot does not exist', async () => {
      mockPrismaService.clinicSlot.findUnique.mockResolvedValue(null);

      await expect(service.bookAppointment(patientId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects booking when slot is not bookable', async () => {
      mockPrismaService.clinicSlot.findUnique.mockResolvedValue({
        id: 10,
        capacity: 2,
        isBookable: false,
        appointments: [],
      });

      await expect(service.bookAppointment(patientId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects booking when slot is full (capacity reached)', async () => {
      mockPrismaService.clinicSlot.findUnique.mockResolvedValue({
        id: 10,
        capacity: 1,
        isBookable: true,
        appointments: [
          { id: 1, patientId: 99, status: AppointmentStatus.BOOKED },
        ],
      });

      await expect(service.bookAppointment(patientId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects booking when patient already has an active appointment for the slot', async () => {
      mockPrismaService.clinicSlot.findUnique.mockResolvedValue({
        id: 10,
        capacity: 2,
        isBookable: true,
        appointments: [{ id: 1, patientId, status: AppointmentStatus.BOOKED }],
      });

      await expect(service.bookAppointment(patientId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects booking when patient already has an active appointment at that time', async () => {
      mockPrismaService.clinicSlot.findUnique.mockResolvedValue({
        id: 10,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '09:00',
        endTime: '09:30',
        capacity: 2,
        isBookable: true,
        appointments: [],
      });
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        id: 42,
        patientId,
        status: AppointmentStatus.BOOKED,
      });

      await expect(service.bookAppointment(patientId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findPatientAppointments', () => {
    it('returns all appointments for the patient', async () => {
      mockPrismaService.appointment.findMany.mockResolvedValue([
        {
          id: 1,
          status: AppointmentStatus.BOOKED,
          createdAt: new Date('2026-10-31T00:00:00.000Z'),
          patient: {
            id: 101,
            fullName: 'Patient One',
            affiliation: 'STUDENT',
          },
          slot: {
            id: 10,
            clinicDate: new Date('2026-11-12T00:00:00.000Z'),
            startTime: '10:00',
            endTime: '10:30',
            capacity: 2,
            isBookable: true,
          },
        },
      ]);

      const result = await service.findPatientAppointments(101);
      expect(result.appointments).toHaveLength(1);
      expect(result.appointments[0].id).toBe(1);
      expect(result.appointments[0].slot.clinicDate).toBe('2026-11-12');
    });
  });

  describe('findAppointments', () => {
    it('limits patient results to the authenticated patient', async () => {
      mockPrismaService.appointment.findMany.mockResolvedValue([]);

      await service.findAppointments(101, 'PATIENT');

      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 101 } }),
      );
    });

    it('allows staff to list appointments and returns limited patient data', async () => {
      mockPrismaService.appointment.findMany.mockResolvedValue([
        {
          id: 1,
          status: AppointmentStatus.BOOKED,
          createdAt: new Date('2026-10-31T00:00:00.000Z'),
          patient: {
            id: 101,
            fullName: 'Patient One',
            affiliation: 'STUDENT',
          },
          slot: {
            id: 10,
            clinicDate: new Date('2026-11-12T00:00:00.000Z'),
            startTime: '10:00',
            endTime: '10:30',
            capacity: 2,
            isBookable: true,
          },
        },
      ]);

      const result = await service.findAppointments(202, 'STAFF');

      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result.appointments[0].patient).toEqual({
        id: 101,
        fullName: 'Patient One',
        affiliation: 'STUDENT',
      });
    });
  });

  describe('findAppointment', () => {
    const appointment = {
      id: 1,
      patientId: 101,
      status: AppointmentStatus.BOOKED,
      createdAt: new Date('2026-10-31T00:00:00.000Z'),
      patient: {
        id: 101,
        fullName: 'Patient One',
        affiliation: 'STUDENT',
      },
      slot: {
        id: 10,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '10:30',
        capacity: 2,
        isBookable: true,
      },
    };

    it('returns details for the owning patient', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(appointment);

      const result = await service.findAppointment(101, 'PATIENT', 1);

      expect(result.appointment.id).toBe(1);
      expect(result.appointment.slot.clinicDate).toBe('2026-11-12');
    });

    it('allows staff to view appointment details', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(appointment);

      await expect(
        service.findAppointment(202, 'STAFF', 1),
      ).resolves.toMatchObject({
        appointment: { id: 1 },
      });
    });

    it('rejects patients viewing another patient appointment', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(appointment);

      await expect(service.findAppointment(202, 'PATIENT', 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns not found for a missing appointment', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.findAppointment(101, 'PATIENT', 999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelAppointment', () => {
    it('successfully cancels a booked appointment', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 101,
        status: AppointmentStatus.BOOKED,
        slot: { id: 10 },
      });
      mockPrismaService.appointment.update.mockResolvedValue({
        id: 1,
        status: AppointmentStatus.CANCELLED,
      });
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 2 });

      const result = await service.cancelAppointment(101, 1);
      expect(result.message).toBe('Appointment cancelled successfully');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: AppointmentStatus.CANCELLED },
      });
    });

    it('rejects cancelling an appointment that does not exist', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(service.cancelAppointment(101, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects cancelling an appointment of another patient', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 999,
        status: AppointmentStatus.BOOKED,
      });

      await expect(service.cancelAppointment(101, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects cancelling an already cancelled appointment', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 101,
        status: AppointmentStatus.CANCELLED,
      });

      await expect(service.cancelAppointment(101, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
