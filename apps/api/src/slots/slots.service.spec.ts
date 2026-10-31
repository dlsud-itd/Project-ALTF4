import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { SlotsService } from './slots.service';

describe('SlotsService', () => {
  let service: SlotsService;

  const mockPrismaService = {
    clinicSlot: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };

  beforeEach(async () => {
    Object.values(mockPrismaService.clinicSlot).forEach((mock) =>
      mock.mockReset(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SlotsService>(SlotsService);
  });

  it('validates slot dates and times in the documented formats', async () => {
    const invalidSlot = plainToInstance(CreateSlotDto, {
      clinicDate: '2026-11-12T10:00:00Z',
      startTime: '10:5',
      endTime: '25:00',
      capacity: 2,
    });

    await expect(validate(invalidSlot)).resolves.not.toHaveLength(0);
    await expect(
      validate(
        plainToInstance(CreateSlotDto, {
          clinicDate: '2026-11-12',
          startTime: '10:05',
          endTime: '10:45',
          capacity: 2,
        }),
      ),
    ).resolves.toHaveLength(0);
  });

  it('rejects null values for optional update fields', async () => {
    const updateWithNullCapacity = plainToInstance(UpdateSlotDto, {
      capacity: null,
    });

    await expect(validate(updateWithNullCapacity)).resolves.not.toHaveLength(0);
  });

  it('lists slots in the inclusive date range with remaining capacity', async () => {
    mockPrismaService.clinicSlot.findMany.mockResolvedValue([
      {
        id: 1,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '10:15',
        endTime: '10:45',
        capacity: 2,
        isBookable: true,
        appointments: [{ status: AppointmentStatus.BOOKED }],
      },
      {
        id: 2,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '11:00',
        endTime: '11:30',
        capacity: 1,
        isBookable: true,
        appointments: [{ status: AppointmentStatus.BOOKED }],
      },
      {
        id: 3,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '11:30',
        endTime: '12:00',
        capacity: 1,
        isBookable: false,
        appointments: [],
      },
    ]);

    await expect(
      service.findSlots('2026-11-12', '2026-11-12'),
    ).resolves.toEqual({
      slots: [
        {
          id: 1,
          clinicDate: '2026-11-12',
          startTime: '10:15',
          endTime: '10:45',
          capacity: 2,
          remainingCapacity: 1,
          isBookable: true,
        },
        {
          id: 2,
          clinicDate: '2026-11-12',
          startTime: '11:00',
          endTime: '11:30',
          capacity: 1,
          remainingCapacity: 0,
          isBookable: false,
        },
        {
          id: 3,
          clinicDate: '2026-11-12',
          startTime: '11:30',
          endTime: '12:00',
          capacity: 1,
          remainingCapacity: 1,
          isBookable: false,
        },
      ],
    });

    expect(mockPrismaService.clinicSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clinicDate: {
            gte: new Date('2026-11-12T00:00:00.000Z'),
            lte: new Date('2026-11-12T23:59:59.999Z'),
          },
        },
        include: {
          appointments: {
            where: { status: AppointmentStatus.BOOKED },
          },
        },
      }),
    );
  });

  it('filters out non-bookable and full slots when availableOnly is true', async () => {
    mockPrismaService.clinicSlot.findMany.mockResolvedValue([
      {
        id: 1,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '10:15',
        endTime: '10:45',
        capacity: 2,
        isBookable: true,
        appointments: [{ status: AppointmentStatus.BOOKED }],
      },
      {
        id: 2,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '11:00',
        endTime: '11:30',
        capacity: 1,
        isBookable: true,
        appointments: [{ status: AppointmentStatus.BOOKED }],
      },
      {
        id: 3,
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '11:30',
        endTime: '12:00',
        capacity: 1,
        isBookable: false,
        appointments: [],
      },
    ]);

    const result = await service.findSlots('2026-11-12', '2026-11-12', true);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].id).toBe(1);
    expect(result.slots[0].isBookable).toBe(true);
    expect(result.slots[0].remainingCapacity).toBe(1);
  });

  it('rejects invalid dates and reversed ranges before querying', async () => {
    await expect(service.findSlots('2026-02-30', '2026-03-01')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.findSlots('2026-11-13', '2026-11-12')).rejects.toThrow(
      BadRequestException,
    );

    expect(mockPrismaService.clinicSlot.findMany).not.toHaveBeenCalled();
  });

  it('creates a slot after checking for overlaps', async () => {
    const dto: CreateSlotDto = {
      clinicDate: '2026-11-12',
      startTime: '10:15',
      endTime: '10:45',
      capacity: 2,
    };
    mockPrismaService.clinicSlot.findFirst.mockResolvedValue(null);
    mockPrismaService.clinicSlot.create.mockResolvedValue({ id: 4 });

    await expect(service.createSlot(dto)).resolves.toEqual({
      message: 'Slot created successfully',
      id: 4,
    });
    expect(mockPrismaService.clinicSlot.create).toHaveBeenCalledWith({
      data: {
        clinicDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '10:15',
        endTime: '10:45',
        capacity: 2,
        isBookable: true,
      },
    });
  });

  it('rejects invalid time order and overlaps', async () => {
    const dto: CreateSlotDto = {
      clinicDate: '2026-11-12',
      startTime: '10:45',
      endTime: '10:15',
      capacity: 2,
    };

    await expect(service.createSlot(dto)).rejects.toThrow(BadRequestException);
    expect(mockPrismaService.clinicSlot.findFirst).not.toHaveBeenCalled();

    mockPrismaService.clinicSlot.findFirst.mockResolvedValue({
      startTime: '10:30',
      endTime: '11:00',
    });
    await expect(
      service.createSlot({ ...dto, startTime: '10:15', endTime: '10:45' }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrismaService.clinicSlot.create).not.toHaveBeenCalled();
  });

  it('rejects empty updates and capacity below booked appointments', async () => {
    await expect(service.updateSlot(1, {})).rejects.toThrow(
      BadRequestException,
    );

    mockPrismaService.clinicSlot.findUnique.mockResolvedValue({
      clinicDate: new Date('2026-11-12T00:00:00.000Z'),
      startTime: '10:15',
      endTime: '10:45',
      capacity: 2,
      appointments: [
        { status: AppointmentStatus.BOOKED },
        { status: AppointmentStatus.BOOKED },
      ],
    });

    await expect(service.updateSlot(1, { capacity: 1 })).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrismaService.clinicSlot.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a slot with booked appointments', async () => {
    mockPrismaService.clinicSlot.findUnique.mockResolvedValue({
      appointments: [{ status: AppointmentStatus.BOOKED }],
    });

    await expect(service.deleteSlot(1)).rejects.toThrow(ConflictException);
    expect(mockPrismaService.clinicSlot.delete).not.toHaveBeenCalled();
  });
});
