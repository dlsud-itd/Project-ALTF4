// Defines the data types and enums for authentication, including user roles,
// user profile structures, and API request/response payloads for login and registration.

// System-wide authorization tiers controlling dashboard access and API privileges.
export enum AccessRole {
  PATIENT = 'PATIENT',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

// Institutional affiliations at DLSU-D used for clinical triage and demographic classification.
export enum ClinicAffiliation {
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY',
  STAFF = 'STAFF',
}

// Authenticated user model stored in client session state.
export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  affiliation?: string;
  isActive: boolean;
};

// API payload contract returned by the /users/me profile endpoint.
export type UserProfileResponse = {
  message?: string;
  id: number;
  fullName: string;
  email: string;
  affiliation: string;
  role: string;
  isActive: boolean;
};

// Request body required for user login authentication.
export type LoginRequest = {
  email: string;
  password: string;
};

// Response payload returned upon successful login containing the JWT bearer token.
export type LoginResponse = {
  message: string;
  userId: number;
  role: string;
  accessToken: string;
};

// Request payload required for patient account registration.
export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  affiliation: ClinicAffiliation;
};

// Response payload returned upon successful account registration.
export type RegisterResponse = {
  message: string;
  userId: number;
};
