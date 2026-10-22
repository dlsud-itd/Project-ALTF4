import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessRole, ClinicAffiliation } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersModule } from '../src/users/users.module';

type TestUser = {
  id: number;
  fullName: string;
  email: string;
  passwordHash: string;
  affiliation: ClinicAffiliation;
  role: AccessRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type LoginResponseBody = {
  accessToken: string;
  message: string;
  role: string;
  userId: number;
};

function responseBody<T>(response: { body: unknown }): T {
  return response.body as T;
}

function errorMessage(response: { body: unknown }): string {
  const body = response.body;
  if (
    typeof body !== 'object' ||
    body === null ||
    !('error' in body) ||
    typeof body.error !== 'string'
  ) {
    throw new Error('Expected an API error response');
  }
  return body.error;
}

describe('Authentication and profile API (e2e)', () => {
  let app: INestApplication<Server>;
  let jwtService: JwtService;
  let seedUser: TestUser;
  let nextUserId: number;
  const users = new Map<number, TestUser>();
  const revokedTokens = new Map<string, { tokenId: string; expiresAt: Date }>();
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousJwtExpiresIn = process.env.JWT_EXPIRES_IN;

  const prismaMock = {
    user: {
      findUnique: jest.fn(
        ({
          where,
          select,
        }: {
          where: { id?: number; email?: string };
          select?: Record<string, boolean>;
        }) => {
          let user: TestUser | null;
          if (where.email) {
            user =
              [...users.values()].find(
                (candidate) => candidate.email === where.email,
              ) ?? null;
          } else {
            user = where.id ? (users.get(where.id) ?? null) : null;
          }
          if (!user || !select) {
            return user;
          }
          const selectedUser = user;
          return Object.fromEntries(
            Object.entries(select)
              .filter(([, shouldInclude]) => shouldInclude)
              .map(([key]) => [key, selectedUser[key as keyof TestUser]]),
          );
        },
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<TestUser, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const now = new Date();
          const user: TestUser = {
            ...data,
            id: nextUserId++,
            createdAt: now,
            updatedAt: now,
          };
          users.set(user.id, user);
          return { id: user.id };
        },
      ),
    },
    revokedToken: {
      findUnique: jest.fn(({ where }: { where: { tokenId: string } }) => {
        return revokedTokens.get(where.tokenId) ?? null;
      }),
      create: jest.fn(
        ({ data }: { data: { tokenId: string; expiresAt: Date } }) => {
          revokedTokens.set(data.tokenId, data);
          return data;
        },
      ),
      deleteMany: jest.fn(
        ({ where }: { where: { expiresAt: { lte: Date } } }) => {
          for (const [tokenId, token] of revokedTokens) {
            if (token.expiresAt <= where.expiresAt.lte) {
              revokedTokens.delete(tokenId);
            }
          }
          return { count: 0 };
        },
      ),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-only-secret-with-sufficient-entropy';
    process.env.JWT_EXPIRES_IN = '1h';
    seedUser = {
      id: 101,
      fullName: 'Test Patient',
      email: 'patient@example.com',
      passwordHash: await argon2.hash('Password123'),
      affiliation: ClinicAffiliation.STUDENT,
      role: AccessRole.PATIENT,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        AuthModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  beforeEach(() => {
    users.clear();
    users.set(seedUser.id, seedUser);
    revokedTokens.clear();
    nextUserId = seedUser.id + 1;
  });

  afterAll(async () => {
    await app.close();
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
    if (previousJwtExpiresIn === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = previousJwtExpiresIn;
    }
  });

  const validRegistration = {
    fullName: '  Example Patient  ',
    email: '  NEW.PATIENT@EXAMPLE.COM ',
    password: 'Password123',
    affiliation: 'student',
  };

  it('registers, normalizes, and stores only an Argon2 password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validRegistration)
      .expect(201);

    expect(response.body).toEqual({
      message: 'User registered successfully',
      userId: 102,
    });
    const createdUser = users.get(102);
    expect(createdUser?.fullName).toBe('Example Patient');
    expect(createdUser?.email).toBe('new.patient@example.com');
    expect(createdUser?.affiliation).toBe(ClinicAffiliation.STUDENT);
    expect(createdUser?.passwordHash).not.toBe(validRegistration.password);
    await expect(
      argon2.verify(createdUser!.passwordHash, validRegistration.password),
    ).resolves.toBe(true);
    expect(response.text).not.toContain('Password123');
    expect(response.text).not.toContain('passwordHash');
  });

  it.each([
    [
      'missing fullName',
      {
        email: 'person@example.com',
        password: 'Password123',
        affiliation: 'student',
      },
    ],
    ['non-string fullName', { ...validRegistration, fullName: 123 }],
    [
      'missing email',
      { fullName: 'Person', password: 'Password123', affiliation: 'student' },
    ],
    ['malformed email', { ...validRegistration, email: 'not-an-email' }],
    ['non-string email', { ...validRegistration, email: 123 }],
    [
      'missing password',
      {
        fullName: 'Person',
        email: 'person@example.com',
        affiliation: 'student',
      },
    ],
    ['short password', { ...validRegistration, password: 'short' }],
    ['non-string password', { ...validRegistration, password: 123 }],
    [
      'missing affiliation',
      {
        fullName: 'Person',
        email: 'person@example.com',
        password: 'Password123',
      },
    ],
    ['invalid affiliation', { ...validRegistration, affiliation: 'visitor' }],
    ['non-string affiliation', { ...validRegistration, affiliation: 123 }],
  ])(
    'rejects registration with %s and returns the standard error shape',
    async (_case, body) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(body)
        .expect(400);

      expect(errorMessage(response).length).toBeGreaterThan(0);
      expect(users.size).toBe(1);
    },
  );

  it('rejects duplicate normalized email addresses with 409', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: ' PATIENT@EXAMPLE.COM ' })
      .expect(409);

    expect(response.body).toEqual({ error: 'Email is already registered' });
    expect(users.size).toBe(1);
  });

  it('authenticates with normalized email and returns a JWT without sensitive fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ' PATIENT@EXAMPLE.COM ', password: 'Password123' })
      .expect(200);

    const loginResponse = responseBody<LoginResponseBody>(response);
    expect(loginResponse).toMatchObject({
      message: 'Login successful',
      userId: seedUser.id,
      role: 'patient',
    });
    expect(typeof loginResponse.accessToken).toBe('string');
    expect(response.text).not.toContain('passwordHash');
    expect(response.text).not.toContain('Password123');
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${loginResponse.accessToken}`)
      .expect(200);
  });

  it.each([
    ['unknown email', 'unknown@example.com', 'Password123'],
    ['incorrect password', 'patient@example.com', 'wrong-password'],
  ])(
    'returns generic credentials errors for %s',
    async (_case, email, password) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid email or password' });
    },
  );

  it.each([
    ['missing email', { password: 'Password123' }],
    ['invalid email', { email: 'invalid', password: 'Password123' }],
    ['missing password', { email: 'patient@example.com' }],
  ])('validates login with %s', async (_case, body) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(body)
      .expect(400);

    expect(errorMessage(response)).toBeTruthy();
  });

  it('retrieves the authenticated user profile without sensitive fields', async () => {
    const token = jwtService.sign({
      sub: seedUser.id,
      email: seedUser.email,
      role: seedUser.role,
      jti: 'profile-token',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      id: seedUser.id,
      fullName: seedUser.fullName,
      email: seedUser.email,
      affiliation: 'student',
      role: 'patient',
      isActive: true,
    });
    expect(response.text).not.toContain('passwordHash');
  });

  it('allows the authenticated user ID route but forbids another user ID', async () => {
    const token = jwtService.sign({
      sub: seedUser.id,
      email: seedUser.email,
      role: seedUser.role,
      jti: 'id-profile-token',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/users/${seedUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/102')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(response.body).toEqual({
      error: 'Cannot retrieve another user profile',
    });
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'not-a-valid-jwt'],
  ])(
    'rejects a %s profile credential with the standard 401 shape',
    async (_case, token) => {
      const profileRequest = request(app.getHttpServer()).get(
        '/api/v1/users/me',
      );
      if (token) {
        profileRequest.set('Authorization', `Bearer ${token}`);
      }
      const response = await profileRequest.expect(401);
      expect(errorMessage(response)).toBeTruthy();
    },
  );

  it('rejects expired profile credentials', async () => {
    const token = jwtService.sign(
      {
        sub: seedUser.id,
        email: seedUser.email,
        role: seedUser.role,
        jti: 'expired-token',
      },
      { expiresIn: '-1s' },
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(errorMessage(response)).toBeTruthy();
  });

  it('invalidates the bearer token on logout', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: seedUser.email, password: 'Password123' })
      .expect(200);
    const token = responseBody<LoginResponseBody>(loginResponse).accessToken;

    const logoutResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(logoutResponse.body).toEqual({ message: 'Logged out successfully' });

    const profileResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(profileResponse.body).toEqual({
      error: 'Unauthorized: invalid or expired token',
    });
  });
});
