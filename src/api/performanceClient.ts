import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { PERFORMANCE_CLIENT_ID, PERFORMANCE_CLIENT_SECRET } from '@/config';
import { waitRateLimit } from '@/shared/utils/rateLimit';

let performanceToken: string | null = null;
let performanceTokenExpiry = 0;

const refreshPerformanceToken = async (): Promise<string> => {
  const now = Date.now();

  if (performanceToken && now < performanceTokenExpiry) {
    return performanceToken;
  }

  await waitRateLimit();

  const response = await axios.post(
    'https://api-performance.ozon.ru:443/api/client/token',
    {
      client_id: PERFORMANCE_CLIENT_ID,
      client_secret: PERFORMANCE_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const data = response.data;

  performanceToken = data.access_token;
  performanceTokenExpiry = now + data.expires_in * 1000 - 60_000;

  return performanceToken;
};

const performanceClient: AxiosInstance = axios.create({
  baseURL: 'https://api-performance.ozon.ru:443/',
  headers: {
    'Content-Type': 'application/json',
  },
});

performanceClient.interceptors.request.use(
  async (
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> => {
    await waitRateLimit();
    config.headers = config.headers ?? {};
    const token = await refreshPerformanceToken();
    config.headers['Authorization'] = `Bearer ${token}`;
    return config;
  },
);

export { performanceClient };
