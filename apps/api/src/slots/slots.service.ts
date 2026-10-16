import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async findSlots(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(to) : new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    toDate.setHours(23, 59, 59, 999);

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
    const slotDate = new Date(dto.clinicDate);
    slotDate.setHours(0, 0, 0, 0);

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

    const updateData: Record<string, unknown> = {};
    if (dto.clinicDate) {
      const d = new Date(dto.clinicDate);
      d.setHours(0, 0, 0, 0);
      updateData.clinicDate = d;
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
