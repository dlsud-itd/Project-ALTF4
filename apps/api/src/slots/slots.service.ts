import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';

const MS_PER_DAY = 86_400_000;
const DEFAULT_RANGE_DAYS = 7;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const toUtcDate = (value: string, fieldName: string): Date => {
  if (!DATE_FORMAT.test(value)) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${fieldName} must be a valid calendar date`);
  }

  return date;
};

const todayAsUtcDate = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async findSlots(from?: string, to?: string, availableOnly = false) {
    const fromDate =
      from !== undefined ? toUtcDate(from, 'from') : todayAsUtcDate();
    const toDate =
      to !== undefined
        ? toUtcDate(to, 'to')
        : new Date(fromDate.getTime() + DEFAULT_RANGE_DAYS * MS_PER_DAY);
    toDate.setUTCHours(23, 59, 59, 999);

    if (toDate < fromDate) {
      throw new BadRequestException('to must be on or after from');
    }

    const slots = await this.prisma.clinicSlot.findMany({
      where: {
        clinicDate: {
          gte: fromDate,
          lte: toDate,
        },
        ...(availableOnly ? { isBookable: true } : {}),
      },
      include: {
        appointments: {
          where: {
            status: AppointmentStatus.BOOKED,
          },
        },
      },
      orderBy: [{ clinicDate: 'asc' }, { startTime: 'asc' }],
    });

    const mapped = slots.map((slot) => {
      const remainingCapacity = Math.max(
        0,
        slot.capacity - slot.appointments.length,
      );

      return {
        id: slot.id,
        clinicDate: slot.clinicDate.toISOString().slice(0, 10),
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        remainingCapacity,
        isBookable: slot.isBookable && remainingCapacity > 0,
      };
    });

    return {
      slots: availableOnly
        ? mapped.filter((slot) => slot.isBookable && slot.remainingCapacity > 0)
        : mapped,
    };
  }

  async createSlot(dto: CreateSlotDto) {
    const clinicDate = toUtcDate(dto.clinicDate, 'clinicDate');
    await this.assertValidSlot(clinicDate, dto.startTime, dto.endTime);

    const created = await this.prisma.clinicSlot.create({
      data: {
        clinicDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        capacity: dto.capacity,
        isBookable: dto.isBookable ?? true,
      },
    });

    return {
      message: 'Slot created successfully',
      id: created.id,
    };
  }

  async updateSlot(id: number, dto: UpdateSlotDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one slot field must be provided');
    }

    const existing = await this.prisma.clinicSlot.findUnique({
      where: { id },
      include: {
        appointments: {
          where: { status: AppointmentStatus.BOOKED },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Slot not found');
    }

    if (
      dto.capacity !== undefined &&
      dto.capacity < existing.appointments.length
    ) {
      throw new ConflictException(
        'Capacity cannot be lower than booked appointments',
      );
    }

    const clinicDate =
      dto.clinicDate !== undefined
        ? toUtcDate(dto.clinicDate, 'clinicDate')
        : existing.clinicDate;
    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;
    await this.assertValidSlot(clinicDate, startTime, endTime, id);

    const updateData: Prisma.ClinicSlotUpdateInput = {
      ...(dto.clinicDate !== undefined && { clinicDate }),
      ...(dto.startTime !== undefined && { startTime }),
      ...(dto.endTime !== undefined && { endTime }),
      ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      ...(dto.isBookable !== undefined && { isBookable: dto.isBookable }),
    };

    await this.prisma.clinicSlot.update({
      where: { id },
      data: updateData,
    });

    return {
      message: 'Slot updated successfully',
    };
  }

  private async assertValidSlot(
    clinicDate: Date,
    startTime: string,
    endTime: string,
    excludeId?: number,
  ): Promise<void> {
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be later than startTime');
    }

    const overlapping = await this.prisma.clinicSlot.findFirst({
      where: {
        clinicDate,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        ...(excludeId !== undefined && { id: { not: excludeId } }),
      },
    });
    if (overlapping) {
      throw new ConflictException(
        `Overlaps an existing slot (${overlapping.startTime} - ${overlapping.endTime})`,
      );
    }
  }

  async deleteSlot(id: number) {
    const existing = await this.prisma.clinicSlot.findUnique({
      where: { id },
      include: {
        appointments: {
          where: { status: AppointmentStatus.BOOKED },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Slot not found');
    }

    if (existing.appointments.length > 0) {
      throw new ConflictException(
        'Slot has active appointments. Set isBookable to false instead',
      );
    }

    await this.prisma.clinicSlot.delete({
      where: { id },
    });

    return {
      message: 'Slot deleted successfully',
    };
  }
}
