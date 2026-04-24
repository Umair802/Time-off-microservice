import express from 'express';

const app = express();
app.use(express.json());

/**
 * In-memory HCM state.
 * Key format: `${employeeId}:${locationId}:${leaveTypeCode}`
 */
const balances: Map<string, { available: number; used: number }> = new Map();
const timeOffRecords: Map<
  string,
  {
    employeeId: string;
    locationId: string;
    leaveTypeCode: string;
    days: number;
    startDate: string;
    endDate: string;
  }
> = new Map();
let referenceCounter = 1000;

// Seed some default balances
balances.set('EMP001:LOC001:VACATION', { available: 20, used: 0 });
balances.set('EMP001:LOC001:SICK', { available: 10, used: 0 });
balances.set('EMP002:LOC001:VACATION', { available: 15, used: 3 });
balances.set('EMP002:LOC002:VACATION', { available: 12, used: 0 });

/**
 * GET /api/hcm/balances/:employeeId/:locationId/:leaveTypeCode
 * Real-time balance lookup.
 */
app.get(
  '/api/hcm/balances/:employeeId/:locationId/:leaveTypeCode',
  (req, res) => {
    const { employeeId, locationId, leaveTypeCode } = req.params;
    const key = `${employeeId}:${locationId}:${leaveTypeCode}`;
    const balance = balances.get(key);

    if (!balance) {
      return res.status(404).json({
        error: 'BALANCE_NOT_FOUND',
        message: `No balance found for ${key}`,
      });
    }

    res.json({
      employeeId,
      locationId,
      leaveTypeCode,
      available: balance.available,
      used: balance.used,
    });
  },
);

/**
 * POST /api/hcm/time-off
 * Submit a time-off request to HCM.
 */
app.post('/api/hcm/time-off', (req, res) => {
  const { employeeId, locationId, leaveTypeCode, days, startDate, endDate } =
    req.body;
  const key = `${employeeId}:${locationId}:${leaveTypeCode}`;
  const balance = balances.get(key);

  if (!balance) {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_DIMENSIONS',
      errorMessage: `Invalid combination: ${key}`,
    });
  }

  const effectiveBalance = balance.available - balance.used;
  if (days > effectiveBalance) {
    return res.status(400).json({
      success: false,
      errorCode: 'INSUFFICIENT_BALANCE',
      errorMessage: `Insufficient balance. Available: ${effectiveBalance}, Requested: ${days}`,
    });
  }

  // Deduct the balance
  balance.used += days;
  balances.set(key, balance);

  const referenceId = `HCM-REF-${++referenceCounter}`;
  timeOffRecords.set(referenceId, {
    employeeId,
    locationId,
    leaveTypeCode,
    days,
    startDate,
    endDate,
  });

  res.json({
    success: true,
    referenceId,
  });
});

/**
 * DELETE /api/hcm/time-off/:referenceId
 * Cancel a previously submitted time-off.
 */
app.delete('/api/hcm/time-off/:referenceId', (req, res) => {
  const { referenceId } = req.params;
  const record = timeOffRecords.get(referenceId);

  if (!record) {
    return res.status(404).json({
      success: false,
      errorCode: 'REFERENCE_NOT_FOUND',
      errorMessage: `Time-off reference ${referenceId} not found`,
    });
  }

  // Restore balance
  const key = `${record.employeeId}:${record.locationId}:${record.leaveTypeCode}`;
  const balance = balances.get(key);
  if (balance) {
    balance.used = Math.max(0, balance.used - record.days);
    balances.set(key, balance);
  }

  timeOffRecords.delete(referenceId);

  res.json({ success: true });
});

/**
 * POST /api/hcm/admin/set-balance
 * Admin endpoint to simulate balance changes (anniversary, year reset, etc.)
 */
app.post('/api/hcm/admin/set-balance', (req, res) => {
  const { employeeId, locationId, leaveTypeCode, available, used } = req.body;
  const key = `${employeeId}:${locationId}:${leaveTypeCode}`;
  balances.set(key, { available, used: used || 0 });
  res.json({ success: true, key, balance: balances.get(key) });
});

/**
 * GET /api/hcm/admin/all-balances
 * Debug endpoint to view all HCM balances.
 */
app.get('/api/hcm/admin/all-balances', (_req, res) => {
  const all: any[] = [];
  balances.forEach((value, key) => {
    const [employeeId, locationId, leaveTypeCode] = key.split(':');
    all.push({ employeeId, locationId, leaveTypeCode, ...value });
  });
  res.json(all);
});

/**
 * POST /api/hcm/admin/reset
 * Reset all HCM state.
 */
app.post('/api/hcm/admin/reset', (_req, res) => {
  balances.clear();
  timeOffRecords.clear();
  referenceCounter = 1000;

  // Re-seed defaults
  balances.set('EMP001:LOC001:VACATION', { available: 20, used: 0 });
  balances.set('EMP001:LOC001:SICK', { available: 10, used: 0 });
  balances.set('EMP002:LOC001:VACATION', { available: 15, used: 3 });
  balances.set('EMP002:LOC002:VACATION', { available: 12, used: 0 });

  res.json({ success: true, message: 'HCM state reset' });
});

const PORT = process.env.HCM_PORT || 3001;

// Only start if run directly (not imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Mock HCM Server running on http://localhost:${PORT}`);
    console.log('Seeded balances:');
    balances.forEach((v, k) => console.log(`  ${k}: avail=${v.available}, used=${v.used}`));
  });
}

export { app, balances, timeOffRecords };
export default app;
