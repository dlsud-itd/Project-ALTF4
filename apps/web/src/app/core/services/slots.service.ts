import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { SlotsResponse } from '../models/slot.models';

@Injectable({
  providedIn: 'root',
})
export class SlotsService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
  ) {}

  getSlots(from?: string, to?: string): Observable<SlotsResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);

    return this.http.get<SlotsResponse>(`${this.apiConfig.apiUrl}/slots`, { params });
  }
}
