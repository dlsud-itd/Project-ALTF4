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
import { authGuard } from './auth.guard';

const TOKEN_KEY = 'clinicqueue_token';

const createUser = (isActive: boolean): AuthUser => ({
  id: 1,
  fullName: 'Test User',
  email: 'test@university.edu',
  role: 'PATIENT',
  isActive,
});

describe('authGuard', () => {
  let authService: AuthService;
  let navigateSpy: jasmine.Spy;

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/patient' } as RouterStateSnapshot;

  const runGuard = (): boolean =>
    TestBed.runInInjectionContext(() => authGuard(route, state)) as boolean;

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
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(
      true,
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should send a signed-out visitor to login with a return url', () => {
    expect(runGuard()).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/patient' },
    });
  });

  it('should allow an active signed-in user', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');
    authService.currentUser.set(createUser(true));

    expect(runGuard()).toBeTrue();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should clear the session and flag an inactive account', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');
    authService.currentUser.set(createUser(false));

    expect(runGuard()).toBeFalse();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'inactive' },
    });
  });
});