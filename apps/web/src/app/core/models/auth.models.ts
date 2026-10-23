// Defines the data types and enums for authentication, including user roles,
// user profile structures, and API request/response payloads for login and registration.

export enum AccessRole {
  PATIENT = 'PATIENT',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

export enum ClinicAffiliation {
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY',
  STAFF = 'STAFF',
}

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  affiliation?: string;
  isActive: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  message: string;
  userId: number;
  role: string;
  accessToken: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  affiliation: ClinicAffiliation;
};

export type RegisterResponse = {
  message: string;
  userId: number;
};
