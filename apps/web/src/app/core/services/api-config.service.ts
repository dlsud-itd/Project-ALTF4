import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

// Optional runtime environment override configuration injected on the browser window.
type RuntimeConfig = {
  apiUrl?: string;
};

declare global {
  interface Window {
    __CLINICQUEUE_CONFIG__?: RuntimeConfig;
  }
}

// Service providing access to backend base URLs with dynamic runtime window override support.
@Injectable({
  providedIn: 'root',
})
export class ApiConfigService {
  // Resolves the API base URL, prioritizing runtime window configuration over build environment defaults.
  get apiUrl(): string {
    const runtimeUrl = typeof window !== 'undefined' ? window.__CLINICQUEUE_CONFIG__?.apiUrl : undefined;
    return runtimeUrl || environment.apiUrl;
  }
}
