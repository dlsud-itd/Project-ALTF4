import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessRole, AppointmentStatus, ClinicAffiliation } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { SlotsModule } from '../src/slots/slots.module';
import { AppointmentsModule } from '../src/appointments/appointments.module';

type MockUser = {
  id: number;
  fullName: string;
  email: string;
  affiliation: ClinicAffiliation;
  role: AccessRole;
  isActive: boolean;
};

type MockSlot = {
  id: number;
  clinicDate: Date;
  startTime: string;
  endTime: string;
  capacity: number;
  isBookable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MockAppointment = {
  id: number;
  patientId: number;
  slotId: number;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
};

describe('Patient to Staff Booking & Capacity Synchronization Smoke Test (e2e)', () => {
  let app: INestApplication<Server>;
  let jwtService: JwtService;

  const users = new Map<number, MockUser>();
  const slots = new Map<number, MockSlot>();
  const appointments = new Map<number, MockAppointment>();
  let nextSlotId = 1;
  let nextAppointmentId = 1;

  const staffUser: MockUser = {
    id: 1,
    fullName: 'Nurse Joy',
    email: 'staff@example.com',
    affiliation: ClinicAffiliation.STAFF,
    role: AccessRole.STAFF,
    isActive: true,
  };

  const patient1: MockUser = {
    id: 10,
    fullName: 'Patient One',
    email: 'patient1@example.com',
    affiliation: ClinicAffiliation.STUDENT,
    role: AccessRole.PATIENT,
    isActive: true,
  };

  const patient2: MockUser = {
    id: 20,
    fullName: 'Patient Two',
    email: 'patient2@example.com',
    affiliation: ClinicAffiliation.STUDENT,
    role: AccessRole.PATIENT,
    isActive: true,
  };

  let staffToken: string;
  let patient1Token: string;
  let patient2Token: string;

  const prismaMock = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id?: number; email?: string } }) => {
        if (where.id) return users.get(where.id) ?? null;
        if (where.email) {
          return [...users.values()].find((u) => u.email === where.email) ?? null;
        }
        return null;
      }),
    },
    clinicSlot: {
      findMany: jest.fn(({ where }: { where: { clinicDate?: { gte?: Date; lte?: Date }; isBookable?: boolean } }) => {
        let result = [...slots.values()];
        if (where?.clinicDate?.gte && where?.clinicDate?.lte) {
          result = result.filter(
            (s) => s.clinicDate >= where.clinicDate!.gte! && s.clinicDate <= where.clinicDate!.lte!,
          );
        }
        if (where?.isBookable !== undefined) {
          result = result.filter((s) => s.isBookable === where.isBookable);
        }
        result.sort((a, b) => a.startTime.localeCompare(b.startTime));
        return result.map((slot) => ({
          ...slot,
          appointments: [...appointments.values()].filter(
            (a) => a.slotId === slot.id && a.status === AppointmentStatus.BOOKED,
          ),
        }));
      }),
      findUnique: jest.fn(({ where }: { where: { id: number } }) => {
        const slot = slots.get(where.id);
        if (!slot) return null;
        return {
          ...slot,
          appointments: [...appointments.values()].filter(
            (a) => a.slotId === slot.id && a.status === AppointmentStatus.BOOKED,
          ),
        };
      }),
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: {
            clinicDate: Date;
            startTime: { lt: string };
            endTime: { gt: string };
            id?: { not: number };
          };
        }) => {
          return (
            [...slots.values()].find(
              (s) =>
                s.clinicDate.getTime() === where.clinicDate.getTime() &&
                s.startTime < where.endTime.gt &&
                s.endTime > where.startTime.lt &&
                (where.id?.not === undefined || s.id !== where.id.not),
            ) ?? null
          );
        },
      ),
      create: jest.fn(({ data }: { data: Omit<MockSlot, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const now = new Date();
        const slot: MockSlot = {
          ...data,
          id: nextSlotId++,
          createdAt: now,
          updatedAt: now,
        };
        slots.set(slot.id, slot);
        return slot;
      }),
      update: jest.fn(({ where, data }: { where: { id: number }; data: Partial<MockSlot> }) => {
        const slot = slots.get(where.id);
        if (!slot) return null;
        const updated = { ...slot, ...data, updatedAt: new Date() };
        slots.set(where.id, updated);
        return updated;
      }),
      delete: jest.fn(({ where }: { where: { id: number } }) => {
        const slot = slots.get(where.id);
        if (slot) slots.delete(where.id);
        return slot;
      }),
    },
    appointment: {
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: {
            patientId: number;
            status: AppointmentStatus;
            slot: { clinicDate: Date; startTime: string };
            id?: { not: number };
          };
        }) => {
          return (
            [...appointments.values()].find((a) => {
              if (where.id?.not !== undefined && a.id === where.id.not) return false;
              if (a.patientId !== where.patientId || a.status !== where.status) return false;
              const slot = slots.get(a.slotId);
              if (!slot) return false;
              return (
                slot.clinicDate.getTime() === where.slot.clinicDate.getTime() &&
                slot.startTime === where.slot.startTime
              );
            }) ?? null
          );
        },
      ),
      findUnique: jest.fn(({ where }: { where: { id: number } }) => {
        const appt = appointments.get(where.id);
        if (!appt) return null;
        const slot = slots.get(appt.slotId)!;
        const patient = users.get(appt.patientId)!;
        return {
          ...appt,
          slot,
          patient: {
            id: patient.id,
            fullName: patient.fullName,
            affiliation: patient.affiliation,
          },
        };
      }),
      findMany: jest.fn(({ where }: { where: { patientId?: number } }) => {
        let appts = [...appointments.values()];
        if (where?.patientId) {
          appts = appts.filter((a) => a.patientId === where.patientId);
        }
        return appts.map((appt) => ({
          ...appt,
          slot: slots.get(appt.slotId)!,
          patient: users.get(appt.patientId)!,
        }));
      }),
      create: jest.fn(({ data }: { data: { patientId: number; slotId: number; status: AppointmentStatus } }) => {
        const now = new Date();
        const appt: MockAppointment = {
          ...data,
          id: nextAppointmentId++,
          createdAt: now,
          updatedAt: now,
        };
        appointments.set(appt.id, appt);
        const slot = slots.get(appt.slotId)!;
        return {
          ...appt,
          slot,
        };
      }),
      update: jest.fn(({ where, data }: { where: { id: number }; data: Partial<MockAppointment> }) => {
        const appt = appointments.get(where.id);
        if (!appt) return null;
        const updated = { ...appt, ...data, updatedAt: new Date() };
        appointments.set(where.id, updated);
        return updated;
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    revokedToken: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'smoke-test-secret-with-sufficient-length';
    process.env.JWT_EXPIRES_IN = '1h';

    users.set(staffUser.id, staffUser);
    users.set(patient1.id, patient1);
    users.set(patient2.id, patient2);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        AuthModule,
        SlotsModule,
        AppointmentsModule,
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
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    staffToken = jwtService.sign({
      sub: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      jti: 'staff-token',
    });
    patient1Token = jwtService.sign({
      sub: patient1.id,
      email: patient1.email,
      role: patient1.role,
      jti: 'patient1-token',
    });
    patient2Token = jwtService.sign({
      sub: patient2.id,
      email: patient2.email,
      role: patient2.role,
      jti: 'patient2-token',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs complete patient-to-staff booking lifecycle with capacity synchronization', async () => {
    // 1. Staff creates Slot 1 (capacity = 1)
    const createSlot1Res = await request(app.getHttpServer())
      .post('/api/v1/slots')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        clinicDate: '2026-11-20',
        startTime: '09:00',
        endTime: '09:30',
        capacity: 1,
        isBookable: true,
      })
      .expect(201);

    const slot1Id: number = createSlot1Res.body.id;
    expect(slot1Id).toBeDefined();

    // 2. Staff verifies Slot 1 in schedule
    const staffSlotsRes1 = await request(app.getHttpServer())
      .get('/api/v1/slots?from=2026-11-20&to=2026-11-20')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(staffSlotsRes1.body.slots.length).toBe(1);
    expect(staffSlotsRes1.body.slots[0]).toMatchObject({
      id: slot1Id,
      capacity: 1,
      remainingCapacity: 1,
      isBookable: true,
    });

    // 3. Patient 1 views available slots and books Slot 1
    const availableSlotsRes1 = await request(app.getHttpServer())
      .get('/api/v1/slots?from=2026-11-20&to=2026-11-20&availableOnly=true')
      .set('Authorization', `Bearer ${patient1Token}`)
      .expect(200);

    expect(availableSlotsRes1.body.slots.some((s: { id: number }) => s.id === slot1Id)).toBe(true);

    const bookRes = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({
        slotId: slot1Id,
        reasonForVisit: 'General Medical Consultation',
      })
      .expect(201);

    const appointmentId: number = bookRes.body.appointment.id;
    expect(bookRes.body.appointment.slot.remainingCapacity).toBe(0);

    // 4. Staff verifies Slot 1 is now Full (remainingCapacity = 0, isBookable = false)
    const staffSlotsRes2 = await request(app.getHttpServer())
      .get('/api/v1/slots?from=2026-11-20&to=2026-11-20')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(staffSlotsRes2.body.slots[0]).toMatchObject({
      id: slot1Id,
      capacity: 1,
      remainingCapacity: 0,
      isBookable: false,
    });

    // 5. Patient 2 cannot book Slot 1 (409 Conflict - slot full)
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ slotId: slot1Id })
      .expect(409);

    // 6. Staff creates Slot 2 (capacity = 2)
    const createSlot2Res = await request(app.getHttpServer())
      .post('/api/v1/slots')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        clinicDate: '2026-11-20',
        startTime: '10:00',
        endTime: '10:30',
        capacity: 2,
        isBookable: true,
      })
      .expect(201);

    const slot2Id: number = createSlot2Res.body.id;

    // 7. Patient 1 reschedules appointment from Slot 1 to Slot 2
    const rescheduleRes = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({ slotId: slot2Id })
      .expect(200);

    expect(rescheduleRes.body.message).toContain('rescheduled successfully');
    expect(rescheduleRes.body.appointment.slot.remainingCapacity).toBe(1);

    // 8. Staff checks schedule: Slot 1 is restored (remainingCapacity = 1) and Slot 2 has 1 seat taken
    const staffSlotsRes3 = await request(app.getHttpServer())
      .get('/api/v1/slots?from=2026-11-20&to=2026-11-20')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const s1 = staffSlotsRes3.body.slots.find((s: { id: number }) => s.id === slot1Id);
    const s2 = staffSlotsRes3.body.slots.find((s: { id: number }) => s.id === slot2Id);

    expect(s1.remainingCapacity).toBe(1);
    expect(s1.isBookable).toBe(true);

    expect(s2.remainingCapacity).toBe(1);
    expect(s2.isBookable).toBe(true);

    // 9. Patient 1 cancels appointment
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .expect(200);

    // 10. Staff checks schedule: Slot 2 capacity is restored back to 2
    const staffSlotsRes4 = await request(app.getHttpServer())
      .get('/api/v1/slots?from=2026-11-20&to=2026-11-20')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const s2AfterCancel = staffSlotsRes4.body.slots.find((s: { id: number }) => s.id === slot2Id);
    expect(s2AfterCancel.remainingCapacity).toBe(2);

    // 11. Staff deletes Slot 1 safely now that it has no active appointments
    await request(app.getHttpServer())
      .delete(`/api/v1/slots/${slot1Id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const staffSlotsRes5 = await request(app.getHttpServer())
      .get('/api/v1/slots?from=2026-11-20&to=2026-11-20')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(staffSlotsRes5.body.slots.some((s: { id: number }) => s.id === slot1Id)).toBe(false);
  });
});
