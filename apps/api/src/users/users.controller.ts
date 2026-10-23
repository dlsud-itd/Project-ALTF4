import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccessRole } from '@prisma/client';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentProfile(
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.usersService.findById(request.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve the authenticated user profile by ID' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({
    status: 403,
    description: 'Cannot retrieve another user profile',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    const isSelf = id === request.user.id;
    const isAdmin = request.user.role === AccessRole.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Cannot retrieve another user profile');
    }

    return this.usersService.findById(id);
  }
}
