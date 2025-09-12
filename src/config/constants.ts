import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)?\s*$/);
      if (match) {
        const [, key, value] = match;
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

export const APP_CONSTANTS = {
  PORT: parseInt(process.env.PORT ?? '3000', 10),
};

export type AppConstants = typeof APP_CONSTANTS;
