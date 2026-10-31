import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccessRole } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @Roles(AccessRole.PATIENT, AccessRole.STAFF, AccessRole.ADMIN)
  @ApiOperation({ summary: 'List permitted appointments for the current user' })
  @ApiResponse({ status: 200, description: 'List of permitted appointments' })
  async getAppointments(@Request() req: { user: AuthenticatedUser }) {
    return this.appointmentsService.findAppointments(
      req.user.id,
      req.user.role,
    );
  }

  @Post()
  @Roles(AccessRole.PATIENT)
  @ApiOperation({
    summary: 'Book a clinic appointment into an available slot (Patient)',
  })
  @ApiResponse({ status: 201, description: 'Appointment booked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid booking data' })
  @ApiResponse({ status: 404, description: 'Clinic slot not found' })
  @ApiResponse({
    status: 409,
    description: 'Slot is full, closed, or duplicate booking',
  })
  async bookAppointment(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.bookAppointment(req.user.id, dto);
  }

  @Get('my')
  @Roles(AccessRole.PATIENT)
  @ApiOperation({ summary: 'Get current logged-in patient appointments' })
  @ApiResponse({ status: 200, description: 'List of patient appointments' })
  async getMyAppointments(@Request() req: { user: AuthenticatedUser }) {
    return this.appointmentsService.findPatientAppointments(req.user.id);
  }

  @Get(':id')
  @Roles(AccessRole.PATIENT, AccessRole.STAFF, AccessRole.ADMIN)
  @ApiOperation({ summary: 'Get an appointment available to the current user' })
  @ApiResponse({ status: 200, description: 'Appointment details' })
  @ApiResponse({ status: 403, description: 'Forbidden: not your appointment' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async getAppointment(
    @Request() req: { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentsService.findAppointment(
      req.user.id,
      req.user.role,
      id,
    );
  }

  @Patch(':id/cancel')
  @Roles(AccessRole.PATIENT)
  @ApiOperation({ summary: 'Cancel an active appointment (Patient)' })
  @ApiResponse({
    status: 200,
    description: 'Appointment cancelled successfully',
  })
  @ApiResponse({ status: 400, description: 'Appointment cannot be cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden: not your appointment' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async cancelAppointment(
    @Request() req: { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentsService.cancelAppointment(req.user.id, id);
  }
}
