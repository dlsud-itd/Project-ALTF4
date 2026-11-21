import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessRole } from '@prisma/client';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { AdminCreateUserDto } from './dto/create-user.dto';
import { AdminUpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccessRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all registered system users (Admin only)' })
  @ApiResponse({ status: 200, description: 'User list retrieved' })
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user with any role (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async createUser(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: AdminCreateUserDto,
  ) {
    return this.adminService.createUser(request.user.id, dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user account details or role (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid update or self-demotion' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminService.updateUser(request.user.id, id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user account (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteUser(request.user.id, id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get overall clinic statistics and counts (Admin only)' })
  @ApiResponse({ status: 200, description: 'System stats retrieved' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Retrieve system-wide audit trail logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  async getAuditLogs() {
    return this.adminService.getAuditLogs();
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Retrieve all clinic appointments (Admin only)' })
  @ApiResponse({ status: 200, description: 'All appointments retrieved' })
  async getAppointments() {
    return this.adminService.getAppointments();
  }
}
