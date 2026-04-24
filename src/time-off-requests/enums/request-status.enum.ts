export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUBMITTED_TO_HCM = 'SUBMITTED_TO_HCM',
  CONFIRMED = 'CONFIRMED',
  HCM_REJECTED = 'HCM_REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Valid state transitions for a time-off request.
 * Maps current status -> allowed next statuses.
 */
export const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [
    RequestStatus.APPROVED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
  ],
  [RequestStatus.APPROVED]: [
    RequestStatus.SUBMITTED_TO_HCM,
    RequestStatus.CANCELLED,
    RequestStatus.REJECTED,
  ],
  [RequestStatus.REJECTED]: [],
  [RequestStatus.SUBMITTED_TO_HCM]: [
    RequestStatus.CONFIRMED,
    RequestStatus.HCM_REJECTED,
  ],
  [RequestStatus.CONFIRMED]: [RequestStatus.CANCELLED],
  [RequestStatus.HCM_REJECTED]: [
    RequestStatus.PENDING,
    RequestStatus.CANCELLED,
  ],
  [RequestStatus.CANCELLED]: [],
};

export function isValidTransition(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
