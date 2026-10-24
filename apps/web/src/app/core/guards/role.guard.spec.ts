import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { AuthUser } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

const createUser = (role: string): AuthUser => ({
  id: 1,
  fullName: 'Test User',
  email: 'test@university.edu',
  role,
  isActive: true,
});

const createRoute = (roles?: string[]): ActivatedRouteSnapshot =>
  ({ data: roles ? { roles } : {} }) as unknown as ActivatedRouteSnapshot;

describe('roleGuard', () => {
  let authService: AuthService;
  let navigateSpy: jasmine.Spy;
  let navigateByUrlSpy: jasmine.Spy;

  const runGuard = (route: ActivatedRouteSnapshot): boolean =>
    TestBed.runInInjectionContext(() =>
      roleGuard(route, {} as RouterStateSnapshot),
    ) as boolean;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    authService = TestBed.inject(AuthService);
    const router: Router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    navigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should allow any user when the route declares no roles', () => {
    expect(runGuard(createRoute())).toBeTrue();
    expect(runGuard(createRoute([]))).toBeTrue();
  });

  it('should send a user without a profile to login', () => {
    expect(runGuard(createRoute(['STAFF']))).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('should allow a matching role regardless of casing', () => {
    authService.currentUser.set(createUser('staff'));

    expect(runGuard(createRoute(['STAFF', 'ADMIN']))).toBeTrue();
  });

  it('should send a user with the wrong role to their own home', () => {
    authService.currentUser.set(createUser('PATIENT'));

    expect(runGuard(createRoute(['STAFF', 'ADMIN']))).toBeFalse();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/patient');
  });
});