import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface MaestroRunResult {
  passed: boolean;
  durationMs: number;
  screenshotPaths: string[];
  error?: string;
  rawOutput: string;
}

function injectScreenshots(yaml: string, flowName: string, outputDir: string): string {
  const lines = yaml.split('\n');
  const result: string[] = [];
  let stepIndex = 0;

  for (const line of lines) {
    result.push(line);
    if (/^\s+-\s+(tapOn|swipe|scroll|inputText|assertVisible|back)/.test(line)) {
      const screenshotPath = path.join(
        outputDir,
        `${flowName}-step-${String(stepIndex).padStart(3, '0')}.png`,
      );
      result.push(`    - takeScreenshot: "${screenshotPath}"`);
      stepIndex++;
    }
  }
  return result.join('\n');
}

export async function runFlow(
  flowName: string,
  yaml: string,
  deviceUdid: string,
): Promise<MaestroRunResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bridge-'));
  const screenshotDir = path.join(tmpDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const yamlWithScreenshots = injectScreenshots(yaml, flowName, screenshotDir);
  const flowPath = path.join(tmpDir, `${flowName}.yaml`);
  fs.writeFileSync(flowPath, yamlWithScreenshots);

  const start = Date.now();
  let rawOutput = '';
  let passed = false;

  try {
    const { stdout, stderr } = await execFileAsync(
      'maestro',
      ['--device', deviceUdid, 'test', flowPath],
      { timeout: 120_000 },
    );
    rawOutput = stdout + stderr;
    passed = !rawOutput.includes('FAILED') && !rawOutput.includes('Error');
  } catch (err) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    rawOutput = (execErr.stdout ?? '') + (execErr.stderr ?? '');
    passed = false;
  }

  const screenshotPaths = fs.existsSync(screenshotDir)
    ? fs
        .readdirSync(screenshotDir)
        .filter((f) => f.endsWith('.png'))
        .sort()
        .map((f) => path.join(screenshotDir, f))
    : [];

  return {
    passed,
    durationMs: Date.now() - start,
    screenshotPaths,
    error: passed ? undefined : rawOutput.slice(-500),
    rawOutput,
  };
}
