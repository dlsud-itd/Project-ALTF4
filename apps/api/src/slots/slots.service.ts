import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Parses YYYY-MM-DD as UTC midnight so the date column keeps the picked day
// whatever timezone the server runs in.
const toUtcDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

// Today's calendar date on the server, expressed as UTC midnight.
const todayAsUtcDate = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async findSlots(from?: string, to?: string) {
    const fromDate = from ? toUtcDate(from) : todayAsUtcDate();

    const toDate = to ? toUtcDate(to) : new Date(fromDate.getTime() + 7 * MS_PER_DAY);
    toDate.setUTCHours(23, 59, 59, 999);

    if (toDate < fromDate) {
      throw new BadRequestException('Invalid date range');
    }

    const slots = await this.prisma.clinicSlot.findMany({
      where: {
        clinicDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        appointments: {
          where: {
            status: { in: ['BOOKED'] },
          },
        },
      },
      orderBy: [
        { clinicDate: 'asc' },
        { startTime: 'asc' },
      ],
    });

    const formattedSlots = slots.map((slot) => {
      const bookedCount = slot.appointments.length;
      const remainingCapacity = Math.max(0, slot.capacity - bookedCount);
      return {
        id: slot.id,
        clinicDate: slot.clinicDate.toISOString().split('T')[0],
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        remainingCapacity,
        isBookable: slot.isBookable && remainingCapacity > 0,
      };
    });

    return { slots: formattedSlots };
  }

  async createSlot(dto: CreateSlotDto) {
    const slotDate = toUtcDate(dto.clinicDate);
    await this.assertValidSlot(slotDate, dto.startTime, dto.endTime);

    const created = await this.prisma.clinicSlot.create({
      data: {
        clinicDate: slotDate,
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
    const existing = await this.prisma.clinicSlot.findUnique({
      where: { id },
      include: {
        appointments: {
          where: { status: 'BOOKED' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Slot not found');
    }

    if (dto.capacity !== undefined && dto.capacity < existing.appointments.length) {
      throw new ConflictException('Capacity cannot be lower than booked appointments');
    }

    await this.assertValidSlot(
      dto.clinicDate ? toUtcDate(dto.clinicDate) : existing.clinicDate,
      dto.startTime ?? existing.startTime,
      dto.endTime ?? existing.endTime,
      id,
    );

    const updateData: Record<string, unknown> = {};
    if (dto.clinicDate) {
      updateData.clinicDate = toUtcDate(dto.clinicDate);
    }
    if (dto.startTime !== undefined) updateData.startTime = dto.startTime;
    if (dto.endTime !== undefined) updateData.endTime = dto.endTime;
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
    if (dto.isBookable !== undefined) updateData.isBookable = dto.isBookable;

    await this.prisma.clinicSlot.update({
      where: { id },
      data: updateData,
    });

    return {
      message: 'Slot updated successfully',
    };
  }

  // Rejects an end time that is not after the start, and slots that overlap
  // another slot on the same date. HH:mm strings compare correctly as text.
  private async assertValidSlot(
    clinicDate: Date,
    startTime: string,
    endTime: string,
    excludeId?: number,
  ): Promise<void> {
    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
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
          where: { status: 'BOOKED' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Slot not found');
    }

    if (existing.appointments.length > 0) {
      throw new ConflictException('Slot has active appointments. Set isBookable to false instead');
    }

    await this.prisma.clinicSlot.delete({
      where: { id },
    });

    return {
      message: 'Slot deleted successfully',
    };
  }
}
