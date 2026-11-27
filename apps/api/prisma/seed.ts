import 'dotenv/config';
import {
  PrismaClient,
  AccessRole,
  ClinicAffiliation,
  QueueStatus,
  QueuePriority,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { DEFAULT_SERVICE_DURATION_MINUTES } from '../src/common/clinic.constants';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ClinicQueue database...');

  // Create default admin user
  const adminPasswordHash = await argon2.hash('Admin123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinicqueue.internal' },
    update: {},
    create: {
      fullName: 'System Administrator',
      email: 'admin@clinicqueue.internal',
      passwordHash: adminPasswordHash,
      affiliation: ClinicAffiliation.STAFF,
      role: AccessRole.ADMIN,
      isActive: true,
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create default clinic staff user
  const staffPasswordHash = await argon2.hash('Staff123!');
  const staff = await prisma.user.upsert({
    where: { email: 'nurse@clinicqueue.internal' },
    update: {},
    create: {
      fullName: 'Nurse Jane Doe',
      email: 'nurse@clinicqueue.internal',
      passwordHash: staffPasswordHash,
      affiliation: ClinicAffiliation.STAFF,
      role: AccessRole.STAFF,
      isActive: true,
    },
  });
  console.log(`Created staff user: ${staff.email}`);

  // Create sample patient user
  const patientPasswordHash = await argon2.hash('Patient123!');
  const patient = await prisma.user.upsert({
    where: { email: 'patient@clinicqueue.internal' },
    update: {},
    create: {
      fullName: 'Juan Dela Cruz',
      email: 'patient@clinicqueue.internal',
      passwordHash: patientPasswordHash,
      affiliation: ClinicAffiliation.STUDENT,
      role: AccessRole.PATIENT,
      isActive: true,
    },
  });
  console.log(`Created patient user: ${patient.email}`);

  // Create today's daily queue
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyQueue = await prisma.dailyQueue.upsert({
    where: { clinicDate: today },
    update: {},
    create: {
      clinicDate: today,
      nextNumber: 1,
      isOpen: true,
      fallbackServiceMinutes: DEFAULT_SERVICE_DURATION_MINUTES,
    },
  });
  console.log(
    `Created/verified daily queue for ${today.toISOString().split('T')[0]}`,
  );

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
