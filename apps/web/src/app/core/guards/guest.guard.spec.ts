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
import { guestGuard } from './guest.guard';

const TOKEN_KEY = 'clinicqueue_token';

const createUser = (role: string): AuthUser => ({
  id: 1,
  fullName: 'Test User',
  email: 'test@university.edu',
  role,
  isActive: true,
});

describe('guestGuard', () => {
  let authService: AuthService;
  let navigateByUrlSpy: jasmine.Spy;

  const runGuard = (): boolean =>
    TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
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
    navigateByUrlSpy = spyOn(
      TestBed.inject(Router),
      'navigateByUrl',
    ).and.resolveTo(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should let a signed-out visitor see the guest page', () => {
    expect(runGuard()).toBeTrue();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
  });

  it('should send a signed-in staff user to the staff home', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');
    authService.currentUser.set(createUser('STAFF'));

    expect(runGuard()).toBeFalse();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/staff');
  });

  it('should treat a token without a cached user as a patient', () => {
    localStorage.setItem(TOKEN_KEY, 'abc');

    expect(runGuard()).toBeFalse();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/patient');
  });
});