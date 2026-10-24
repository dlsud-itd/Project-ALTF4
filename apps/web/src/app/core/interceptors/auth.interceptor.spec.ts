import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';

const TOKEN_KEY = 'clinicqueue_token';
const API_URL = 'http://localhost:3000/api/v1';
const HTTP_UNAUTHORIZED = 401;
const UNAUTHORIZED = { status: HTTP_UNAUTHORIZED, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let navigateSpy: jasmine.Spy;

  const ignoreError = (_error: HttpErrorResponse): void => undefined;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url', 'get').and.returnValue('/patient');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should add the bearer token when one is stored', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');

    http.get(`${API_URL}/users/me`).subscribe();
    const request = httpMock.expectOne(`${API_URL}/users/me`);

    expect(request.request.headers.get('Authorization')).toBe('Bearer abc');
    request.flush({});
  });

  it('should not send an Authorization header without a token', () => {
    http.get(`${API_URL}/users/me`).subscribe();
    const request = httpMock.expectOne(`${API_URL}/users/me`);

    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('should keep an Authorization header that is already set', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');
    const headers = { Authorization: 'Bearer other' };

    http.get(`${API_URL}/users/me`, { headers }).subscribe();
    const request = httpMock.expectOne(`${API_URL}/users/me`);

    expect(request.request.headers.get('Authorization')).toBe('Bearer other');
    request.flush({});
  });

  it('should clear the session and go to login on a 401', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');

    http.get(`${API_URL}/queue`).subscribe({ error: ignoreError });
    httpMock.expectOne(`${API_URL}/queue`).flush({}, UNAUTHORIZED);

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/patient' },
    });
  });

  it('should not redirect when the logout call returns 401', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');

    http.post(`${API_URL}/auth/logout`, {}).subscribe({ error: ignoreError });
    httpMock.expectOne(`${API_URL}/auth/logout`).flush({}, UNAUTHORIZED);

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should not redirect when a login attempt returns 401', () => {
    http.post(`${API_URL}/auth/login`, {}).subscribe({ error: ignoreError });
    httpMock.expectOne(`${API_URL}/auth/login`).flush({}, UNAUTHORIZED);

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should pass other errors through without redirecting', () => {
    const errors: HttpErrorResponse[] = [];

    http
      .get(`${API_URL}/queue`)
      .subscribe({ error: (error: HttpErrorResponse) => errors.push(error) });
    httpMock
      .expectOne(`${API_URL}/queue`)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(errors[0].status).toBe(500);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});