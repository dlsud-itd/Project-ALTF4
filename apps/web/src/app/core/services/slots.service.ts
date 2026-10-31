import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  SlotFormValue,
  SlotMutationResponse,
  SlotsResponse,
} from '../models/slot.models';

@Injectable({
  providedIn: 'root',
})
export class SlotsService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
  ) {}

  getSlots(
    from?: string,
    to?: string,
    availableOnly?: boolean,
  ): Observable<SlotsResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (availableOnly !== undefined) {
      params = params.set('availableOnly', String(availableOnly));
    }

    return this.http.get<SlotsResponse>(`${this.apiConfig.apiUrl}/slots`, {
      params,
    });
  }

  createSlot(value: SlotFormValue): Observable<SlotMutationResponse> {
    return this.http.post<SlotMutationResponse>(
      `${this.apiConfig.apiUrl}/slots`,
      value,
    );
  }

  deleteSlot(id: number): Observable<SlotMutationResponse> {
    return this.http.delete<SlotMutationResponse>(
      `${this.apiConfig.apiUrl}/slots/${id}`,
    );
  }

  updateSlot(id: number, value: SlotFormValue): Observable<SlotMutationResponse> {
    return this.http.patch<SlotMutationResponse>(
      `${this.apiConfig.apiUrl}/slots/${id}`,
      value,
    );
  }
}
