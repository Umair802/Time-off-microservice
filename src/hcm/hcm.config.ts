export const HCM_CONFIG = {
  baseUrl: process.env.HCM_BASE_URL || 'http://localhost:3001/api/hcm',
  timeout: parseInt(process.env.HCM_TIMEOUT || '5000', 10),
  retryAttempts: parseInt(process.env.HCM_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.HCM_RETRY_DELAY || '1000', 10),
};
