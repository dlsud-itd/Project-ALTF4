import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

type RuntimeConfig = {
  apiUrl?: string;
  wsUrl?: string;
};

declare global {
  interface Window {
    __CLINICQUEUE_CONFIG__?: RuntimeConfig;
  }
}

@Injectable({
  providedIn: 'root',
})
export class ApiConfigService {
  get apiUrl(): string {
    const runtimeUrl = typeof window !== 'undefined' ? window.__CLINICQUEUE_CONFIG__?.apiUrl : undefined;
    return runtimeUrl || environment.apiUrl;
  }

  get wsUrl(): string {
    const runtimeWs = typeof window !== 'undefined' ? window.__CLINICQUEUE_CONFIG__?.wsUrl : undefined;
    return runtimeWs || environment.wsUrl;
  }
}
