import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiConfigService } from '@core/services';
import { NotificationsListResponse, PatientNotification } from '@core/models';
import { PatientNotificationsComponent } from './notifications.component';

const notificationFixture: PatientNotification = {
  id: 8,
  type: 'BOOKING_CONFIRMATION',
  title: 'Booking confirmed',
  message: 'Your booking was confirmed.',
  appointmentId: 12,
  queueEntryId: null,
  isRead: false,
  readAt: null,
  createdAt: '2026-11-20T08:00:00.000Z',
};

const listResponse: NotificationsListResponse = {
  notifications: [notificationFixture],
  unreadCount: 1,
  totalCount: 1,
  page: 1,
  limit: 100,
};

describe('PatientNotificationsComponent', () => {
  let fixture: ComponentFixture<PatientNotificationsComponent>;
  let component: PatientNotificationsComponent;
  let element: HTMLElement;
  let http: HttpTestingController;
  let apiUrl: string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientNotificationsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientNotificationsComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement as HTMLElement;
    http = TestBed.inject(HttpTestingController);
    apiUrl = TestBed.inject(ApiConfigService).apiUrl;
  });

  afterEach(() => {
    http.verify();
  });

  it('loads real notifications from the API and displays their content', () => {
    fixture.detectChanges();

    const request = http.expectOne(
      (req) =>
        req.url === `${apiUrl}/notifications` &&
        req.params.get('page') === '1' &&
        req.params.get('limit') === '100',
    );
    expect(element.querySelector('app-loading-skeleton')).toBeTruthy();
    request.flush(listResponse);
    fixture.detectChanges();

    expect(element.querySelectorAll('.notification-item').length).toBe(1);
    expect(element.querySelector('p-tag')?.textContent).toContain(
      notificationFixture.title,
    );
    expect(element.querySelector('.item-message')?.textContent).toContain(
      notificationFixture.message,
    );
    expect(element.querySelector('.sample-label')).toBeNull();
    expect(component.unreadCount()).toBe(1);
  });

  it('persists read changes through the API', () => {
    fixture.detectChanges();
    http.expectOne(`${apiUrl}/notifications?page=1&limit=100`).flush(listResponse);
    fixture.detectChanges();

    component.markAsRead(notificationFixture.id);
    const request = http.expectOne(
      `${apiUrl}/notifications/${notificationFixture.id}/read`,
    );
    expect(request.request.method).toBe('PATCH');
    request.flush({ ...notificationFixture, isRead: true, readAt: '2026-11-20T08:05:00.000Z' });
    fixture.detectChanges();

    expect(component.unreadCount()).toBe(0);
    expect(element.querySelector('.notification-item.unread')).toBeNull();
  });

  it('persists bulk read changes through the API', () => {
    fixture.detectChanges();
    http.expectOne(`${apiUrl}/notifications?page=1&limit=100`).flush(listResponse);
    fixture.detectChanges();

    component.markAllAsRead();
    const request = http.expectOne(`${apiUrl}/notifications/read-all`);
    expect(request.request.method).toBe('PATCH');
    request.flush({ updatedCount: 1 });
    fixture.detectChanges();

    expect(component.unreadCount()).toBe(0);
  });

  it('shows an error and retries the API request', () => {
    fixture.detectChanges();
    http
      .expectOne(`${apiUrl}/notifications?page=1&limit=100`)
      .flush({ message: 'Server unavailable' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(element.querySelector('app-error-state')).toBeTruthy();

    component.load();
    http.expectOne(`${apiUrl}/notifications?page=1&limit=100`).flush(listResponse);
    fixture.detectChanges();

    expect(element.querySelector('app-error-state')).toBeNull();
    expect(element.querySelectorAll('.notification-item').length).toBe(1);
  });

  it('links booking and queue notification types to their relevant pages', () => {
    expect(component.routeFor('BOOKING_CONFIRMATION')).toBe('/patient/bookings');
    expect(component.routeFor('QUEUE_STATUS_UPDATE')).toBe('/patient/queue');
  });
});
