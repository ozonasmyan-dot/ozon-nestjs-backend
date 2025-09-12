const RATE_LIMIT_DELAY = 300;

let lastCall = 0;

export const waitRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const elapsed = now - lastCall;
  const waitTime = Math.max(0, RATE_LIMIT_DELAY - elapsed);
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastCall = Date.now();
};
