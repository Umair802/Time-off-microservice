import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HCM_CONFIG } from './hcm.config';
import {
  HcmBalanceResponse,
  HcmTimeOffSubmission,
  HcmTimeOffResponse,
} from './interfaces/hcm.interfaces';

@Injectable()
export class HcmService {
  private readonly logger = new Logger(HcmService.name);

  /**
   * Fetch a single balance from HCM real-time API.
   */
  async getBalance(
    employeeId: string,
    locationId: string,
    leaveTypeCode: string,
  ): Promise<HcmBalanceResponse> {
    const url = `${HCM_CONFIG.baseUrl}/balances/${employeeId}/${locationId}/${leaveTypeCode}`;
    return this.fetchWithRetry<HcmBalanceResponse>(url, 'GET');
  }

  /**
   * Submit a time-off request to HCM.
   */
  async submitTimeOff(
    submission: HcmTimeOffSubmission,
  ): Promise<HcmTimeOffResponse> {
    const url = `${HCM_CONFIG.baseUrl}/time-off`;
    return this.fetchWithRetry<HcmTimeOffResponse>(url, 'POST', submission);
  }

  /**
   * Cancel a previously submitted time-off request in HCM.
   */
  async cancelTimeOff(referenceId: string): Promise<HcmTimeOffResponse> {
    const url = `${HCM_CONFIG.baseUrl}/time-off/${referenceId}`;
    return this.fetchWithRetry<HcmTimeOffResponse>(url, 'DELETE');
  }

  /**
   * HTTP fetch with retry logic and timeout.
   */
  private async fetchWithRetry<T>(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= HCM_CONFIG.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          HCM_CONFIG.timeout,
        );

        const options: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        };
        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new HttpException(
            `HCM API error: ${response.status} - ${errorBody}`,
            response.status,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `HCM request attempt ${attempt}/${HCM_CONFIG.retryAttempts} failed: ${lastError.message}`,
        );

        if (attempt < HCM_CONFIG.retryAttempts) {
          await this.delay(HCM_CONFIG.retryDelay * attempt);
        }
      }
    }

    this.logger.error(`HCM request failed after ${HCM_CONFIG.retryAttempts} attempts`);
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
