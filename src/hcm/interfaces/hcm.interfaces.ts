export interface HcmBalanceResponse {
  employeeId: string;
  locationId: string;
  leaveTypeCode: string;
  available: number;
  used: number;
}

export interface HcmTimeOffSubmission {
  employeeId: string;
  locationId: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  days: number;
}

export interface HcmTimeOffResponse {
  success: boolean;
  referenceId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface HcmBatchBalanceItem {
  employeeId: string;
  locationId: string;
  leaveTypeCode: string;
  available: number;
  used: number;
}
