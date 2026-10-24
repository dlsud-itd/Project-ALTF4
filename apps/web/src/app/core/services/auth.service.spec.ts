import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthUser } from '../models/auth.models';
import { ApiConfigService } from './api-config.service';
import { AuthService } from './auth.service';

const TOKEN_KEY = 'clinicqueue_token';
const USER_KEY = 'clinicqueue_user';
const HTTP_SERVER_ERROR = 500;

const user: AuthUser = {
  id: 1,
  fullName: 'Test User',
  email: 'test@university.edu',
  role: 'PATIENT',
  isActive: true,
};

describe('AuthService logout', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let logoutUrl: string;
  let navigateSpy: jasmine.Spy;

  const signIn = (): void => {
    localStorage.setItem(TOKEN_KEY, 'abc');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    service.currentUser.set(user);
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    logoutUrl = `${TestBed.inject(ApiConfigService).apiUrl}/auth/logout`;
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(
      true,
    );
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should call the logout endpoint with the bearer token', () => {
    signIn();

    service.logout().subscribe();
    const request = httpMock.expectOne(logoutUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer abc');
    request.flush({});
  });

  it('should clear the session and go to login after logout', () => {
    signIn();

    service.logout().subscribe();
    httpMock.expectOne(logoutUrl).flush({});

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('should still clear the session when the API call fails', () => {
    signIn();

    service.logout().subscribe();
    httpMock
      .expectOne(logoutUrl)
      .flush({}, { status: HTTP_SERVER_ERROR, statusText: 'Server Error' });

    expect(service.isAuthenticated()).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('should skip the API call when there is no token', () => {
    service.logout().subscribe();

    httpMock.expectNone(logoutUrl);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});