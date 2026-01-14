import dotenv from 'dotenv';
import path from 'path';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
const envFile = isTestEnv ? '.env.test' : '.env';

// Load environment variables from the appropriate .env file
// Use override: false to allow CLI-provided environment variables to take precedence
dotenv.config({ path: path.resolve(__dirname, '../../../', envFile), override: false });
