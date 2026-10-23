import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { successResponse } from '../common/api-response';

// Service responsible for user data access and profile retrieval operations.
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Finds an active or registered user by primary key and returns formatted profile data.
  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        affiliation: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return successResponse('User profile retrieved successfully', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      affiliation: user.affiliation.toLowerCase(),
      role: user.role.toLowerCase(),
      isActive: user.isActive,
    });
  }
}
