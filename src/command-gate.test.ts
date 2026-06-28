import { describe, expect, it } from 'vitest';
import { gateCommand } from './command-gate.js';

describe('gateCommand /provider', () => {
  it('denies /provider for non-admin (null userId)', () => {
    const result = gateCommand(JSON.stringify({ text: '/provider lmstudio' }), null, 'ag-test');
    expect(result).toEqual({ action: 'deny', command: '/provider' });
  });

  it('passes plain text (not a slash command)', () => {
    expect(gateCommand(JSON.stringify({ text: 'hello' }), null, 'ag-test')).toEqual({ action: 'pass' });
  });
});
