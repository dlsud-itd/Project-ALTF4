import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Inclusive start date (YYYY-MM-DD); defaults to today',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description:
      'Inclusive end date (YYYY-MM-DD); defaults to 7 days after from',
  })
  @ApiResponse({ status: 200, description: 'List of clinic slots' })
  @ApiResponse({ status: 400, description: 'Invalid date or date range' })
  async getSlots(@Query('from') from?: string, @Query('to') to?: string) {
    return this.slotsService.findSlots(from, to);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new clinic slot (Staff/Admin)' })
  @ApiResponse({ status: 201, description: 'Slot created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid date, time, or capacity' })
  @ApiResponse({ status: 409, description: 'Slot overlaps an existing slot' })
  async createSlot(@Body() dto: CreateSlotDto) {
    return this.slotsService.createSlot(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a clinic slot (Staff/Admin)' })
  @ApiResponse({ status: 200, description: 'Slot updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid slot data' })
  @ApiResponse({ status: 404, description: 'Slot not found' })
  @ApiResponse({
    status: 409,
    description: 'Slot overlaps or capacity is below active appointments',
  })
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
  @ApiResponse({ status: 404, description: 'Slot not found' })
  @ApiResponse({
    status: 409,
    description: 'Slot has active appointments',
  })
  async deleteSlot(@Param('id', ParseIntPipe) id: number) {
    return this.slotsService.deleteSlot(id);
  }
}
