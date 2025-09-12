import axios from 'axios';
import { SELLER_CLIENT_ID, SELLER_API_KEY } from '@/config';
import { waitRateLimit } from '@/shared/utils/rateLimit';

export const sellerClient = axios.create({
  baseURL: 'https://api-seller.ozon.ru',
  headers: {
    'Content-Type': 'application/json',
    'Client-Id': SELLER_CLIENT_ID,
    'Api-Key': SELLER_API_KEY,
  },
});

sellerClient.interceptors.request.use(async config => {
  await waitRateLimit();
  return config;
});
