import {
  RequestStatus,
  isValidTransition,
  VALID_TRANSITIONS,
} from './enums/request-status.enum';

describe('RequestStatus State Machine', () => {
  describe('isValidTransition', () => {
    it('should allow PENDING -> APPROVED', () => {
      expect(isValidTransition(RequestStatus.PENDING, RequestStatus.APPROVED)).toBe(true);
    });

    it('should allow PENDING -> REJECTED', () => {
      expect(isValidTransition(RequestStatus.PENDING, RequestStatus.REJECTED)).toBe(true);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(isValidTransition(RequestStatus.PENDING, RequestStatus.CANCELLED)).toBe(true);
    });

    it('should allow APPROVED -> SUBMITTED_TO_HCM', () => {
      expect(isValidTransition(RequestStatus.APPROVED, RequestStatus.SUBMITTED_TO_HCM)).toBe(true);
    });

    it('should allow APPROVED -> CANCELLED', () => {
      expect(isValidTransition(RequestStatus.APPROVED, RequestStatus.CANCELLED)).toBe(true);
    });

    it('should allow SUBMITTED_TO_HCM -> CONFIRMED', () => {
      expect(isValidTransition(RequestStatus.SUBMITTED_TO_HCM, RequestStatus.CONFIRMED)).toBe(true);
    });

    it('should allow SUBMITTED_TO_HCM -> HCM_REJECTED', () => {
      expect(isValidTransition(RequestStatus.SUBMITTED_TO_HCM, RequestStatus.HCM_REJECTED)).toBe(true);
    });

    it('should allow CONFIRMED -> CANCELLED', () => {
      expect(isValidTransition(RequestStatus.CONFIRMED, RequestStatus.CANCELLED)).toBe(true);
    });

    it('should allow HCM_REJECTED -> PENDING (retry)', () => {
      expect(isValidTransition(RequestStatus.HCM_REJECTED, RequestStatus.PENDING)).toBe(true);
    });

    it('should allow HCM_REJECTED -> CANCELLED', () => {
      expect(isValidTransition(RequestStatus.HCM_REJECTED, RequestStatus.CANCELLED)).toBe(true);
    });

    // Invalid transitions
    it('should NOT allow PENDING -> CONFIRMED', () => {
      expect(isValidTransition(RequestStatus.PENDING, RequestStatus.CONFIRMED)).toBe(false);
    });

    it('should NOT allow REJECTED -> any status', () => {
      expect(isValidTransition(RequestStatus.REJECTED, RequestStatus.PENDING)).toBe(false);
      expect(isValidTransition(RequestStatus.REJECTED, RequestStatus.APPROVED)).toBe(false);
      expect(isValidTransition(RequestStatus.REJECTED, RequestStatus.CANCELLED)).toBe(false);
    });

    it('should NOT allow CANCELLED -> any status', () => {
      expect(isValidTransition(RequestStatus.CANCELLED, RequestStatus.PENDING)).toBe(false);
      expect(isValidTransition(RequestStatus.CANCELLED, RequestStatus.APPROVED)).toBe(false);
    });

    it('should NOT allow APPROVED -> APPROVED', () => {
      expect(isValidTransition(RequestStatus.APPROVED, RequestStatus.APPROVED)).toBe(false);
    });

    it('should NOT allow CONFIRMED -> APPROVED', () => {
      expect(isValidTransition(RequestStatus.CONFIRMED, RequestStatus.APPROVED)).toBe(false);
    });
  });

  describe('VALID_TRANSITIONS completeness', () => {
    it('should have entries for all statuses', () => {
      const allStatuses = Object.values(RequestStatus);
      for (const status of allStatuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
      }
    });

    it('REJECTED should be a terminal state', () => {
      expect(VALID_TRANSITIONS[RequestStatus.REJECTED]).toEqual([]);
    });

    it('CANCELLED should be a terminal state', () => {
      expect(VALID_TRANSITIONS[RequestStatus.CANCELLED]).toEqual([]);
    });
  });
});
