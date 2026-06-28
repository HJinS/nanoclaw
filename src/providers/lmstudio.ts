import { execFileSync } from 'node:child_process';
import { readEnvFile } from '../env.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('lmstudio', () => {
  const dotenv = readEnvFile(['LMSTUDIO_BASE_URL', 'LMSTUDIO_MODEL']);

  const baseUrl = dotenv.LMSTUDIO_BASE_URL;
  if (!baseUrl) return {};

  let token = 'lm-studio';
  try {
    token = execFileSync(
      'security',
      ['find-generic-password', '-a', process.env.USER ?? '', '-s', 'lmstudio-token', '-w'],
      { encoding: 'utf-8' },
    ).trim();
  } catch {
    // LM Studio may not require auth — use placeholder
  }

  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: token,
  };

  if (dotenv.LMSTUDIO_MODEL) env.LMSTUDIO_MODEL = dotenv.LMSTUDIO_MODEL;

  return { env };
});
