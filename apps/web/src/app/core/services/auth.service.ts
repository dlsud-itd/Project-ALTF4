import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UserProfileResponse,
} from '../models/auth.models';

// Service managing user authentication, JWT session persistence, profile hydration, and secure logout.
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly tokenKey = 'clinicqueue_token';
  private readonly userKey = 'clinicqueue_user';

  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiConfig: ApiConfigService = inject(ApiConfigService);
  private readonly router: Router = inject(Router);

  readonly currentUser = signal<AuthUser | null>(this.getStoredUser());

  // Authenticates credentials, stores JWT access token, fetches authenticated user profile, and updates user state.
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiConfig.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((res: LoginResponse): void => {
          this.setToken(res.accessToken);
        }),
        switchMap((res: LoginResponse): Observable<LoginResponse> =>
          this.getProfile(res.accessToken).pipe(
            tap((profile: UserProfileResponse): void => {
              const user: AuthUser = {
                id: profile.id,
                fullName: profile.fullName,
                email: profile.email,
                role: profile.role,
                affiliation: profile.affiliation,
                isActive: profile.isActive,
              };
              this.setUser(user);
            }),
            map((): LoginResponse => res),
          ),
        ),
      );
  }

  // Submits registration credentials to the backend account creation endpoint.
  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${this.apiConfig.apiUrl}/auth/register`,
      data,
    );
  }

  // Retrieves the authenticated user's profile and active account status from the backend.
  getProfile(token?: string): Observable<UserProfileResponse> {
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : this.getAuthHeaders();
    return this.http.get<UserProfileResponse>(
      `${this.apiConfig.apiUrl}/users/me`,
      { headers },
    );
  }

  // Restores and validates session credentials on application startup, clearing state if invalid or inactive.
  hydrateSession(): Observable<AuthUser | null> {
    const token: string | null = this.getToken();
    if (!token) {
      this.clearSession();
      return of(null);
    }
    return this.getProfile(token).pipe(
      map((profile: UserProfileResponse): AuthUser | null => {
        if (!profile.isActive) {
          this.clearSession();
          return null;
        }
        const user: AuthUser = {
          id: profile.id,
          fullName: profile.fullName,
          email: profile.email,
          role: profile.role,
          affiliation: profile.affiliation,
          isActive: profile.isActive,
        };
        this.setUser(user);
        return user;
      }),
      catchError((): Observable<null> => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  // Notifies backend to revoke active JWT, flushes client credentials, and navigates safely to login.
  logout(): Observable<void> {
    const token: string | null = this.getToken();
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;

    const request$: Observable<unknown> = token
      ? this.http.post<unknown>(
          `${this.apiConfig.apiUrl}/auth/logout`,
          {},
          { headers },
        )
      : of(null);

    return request$.pipe(
      catchError((): Observable<null> => of(null)),
      finalize((): void => {
        this.clearSession();
        void this.router.navigate(['/login']);
      }),
      map((): void => void 0),
    );
  }

  // Convenience trigger to execute logout pipeline without requiring manual component subscription.
  performLogout(): void {
    this.logout().subscribe();
  }

  // Removes session tokens and user records from local storage and resets reactive user signal.
  clearSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    }
    this.currentUser.set(null);
  }

  // Returns the cached JWT authentication token from browser storage or null if absent.
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.tokenKey);
    }
    return null;
  }

  // Checks whether an authentication token currently exists in storage.
  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  // Constructs HTTP headers including Bearer authorization if a valid token is present.
  getAuthHeaders(): HttpHeaders {
    const token: string | null = this.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // Persists the JWT access token string to browser local storage.
  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
    }
  }

  // Serializes and stores the authenticated user profile in local storage and updates the reactive signal.
  private setUser(user: AuthUser): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    }
    this.currentUser.set(user);
  }

  // Retrieves and deserializes the cached user profile from local storage upon service initialization.
  private getStoredUser(): AuthUser | null {
    if (typeof window !== 'undefined') {
      const stored: string | null = localStorage.getItem(this.userKey);
      if (stored) {
        try {
          return JSON.parse(stored) as AuthUser;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}
