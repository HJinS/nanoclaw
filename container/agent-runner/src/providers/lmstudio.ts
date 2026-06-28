import { ClaudeProvider } from './claude.js';
import { registerProvider } from './provider-registry.js';
import type { ProviderOptions } from './types.js';

class LMStudioProvider extends ClaudeProvider {
  constructor(options: ProviderOptions = {}) {
    super({
      ...options,
      model: options.model ?? process.env.LMSTUDIO_MODEL ?? 'openai/gpt-oss-20b',
    });
  }
}

registerProvider('lmstudio', (opts) => new LMStudioProvider(opts));
