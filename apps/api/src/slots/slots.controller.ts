import { Controller, Get, Post, Patch, Delete, Param, Query, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AccessRole } from '@prisma/client';
import { SlotsService } from './slots.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Clinic Slots')
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  @ApiOperation({ summary: 'List clinic slots in a date range' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'List of clinic slots' })
  async getSlots(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.slotsService.findSlots(from, to);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new clinic slot (Staff/Admin)' })
  @ApiResponse({ status: 201, description: 'Slot created successfully' })
  async createSlot(@Body() dto: CreateSlotDto) {
    return this.slotsService.createSlot(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a clinic slot (Staff/Admin)' })
  @ApiResponse({ status: 200, description: 'Slot updated successfully' })
  async updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlotDto,
  ) {
    return this.slotsService.updateSlot(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an unused clinic slot (Staff/Admin)' })
  @ApiResponse({ status: 200, description: 'Slot deleted successfully' })
  async deleteSlot(@Param('id', ParseIntPipe) id: number) {
    return this.slotsService.deleteSlot(id);
  }
}
