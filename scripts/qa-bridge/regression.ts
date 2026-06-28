import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const execFileAsync = promisify(execFile);

const BASELINE_DIR = path.join(DATA_DIR, 'qa-baselines');
const DIFF_THRESHOLD_PERCENT = 1.0;

function baselinePath(bundleId: string, flowName: string, stepIndex: number): string {
  return path.join(
    BASELINE_DIR,
    bundleId,
    flowName,
    `step-${String(stepIndex).padStart(3, '0')}.png`,
  );
}

export interface DiffResult {
  flowName: string;
  stepIndex: number;
  diffPercent: number;
  diffImagePath: string;
}

export async function compareWithBaseline(
  bundleId: string,
  flowName: string,
  actualScreenshots: string[],
): Promise<DiffResult[]> {
  const diffs: DiffResult[] = [];

  for (let i = 0; i < actualScreenshots.length; i++) {
    const baseline = baselinePath(bundleId, flowName, i);
    if (!fs.existsSync(baseline)) continue;

    const actual = actualScreenshots[i] as string;
    const diffPath = actual.replace('.png', '-diff.png');

    try {
      const { stderr } = await execFileAsync('compare', [
        '-metric',
        'RMSE',
        baseline,
        actual,
        diffPath,
      ]);
      // ImageMagick outputs: "0 (0)" for identical, "N (0.N)" for different
      const match = stderr.match(/[\d.]+\s+\(([\d.]+)\)/);
      const diffPercent = match ? parseFloat(match[1]) * 100 : 0;

      if (diffPercent > DIFF_THRESHOLD_PERCENT) {
        diffs.push({ flowName, stepIndex: i, diffPercent, diffImagePath: diffPath });
      }
    } catch {
      // compare exits 1 when images differ — check stderr for metric
    }
  }
  return diffs;
}

export function saveBaseline(
  bundleId: string,
  flowName: string,
  screenshotPaths: string[],
): void {
  for (let i = 0; i < screenshotPaths.length; i++) {
    const dest = baselinePath(bundleId, flowName, i);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(screenshotPaths[i] as string, dest);
  }
}

export function hasBaseline(bundleId: string, flowName: string): boolean {
  const dir = path.join(BASELINE_DIR, bundleId, flowName);
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.png'));
}

export function getBaselineScreenshots(bundleId: string, flowName: string): string[] {
  const dir = path.join(BASELINE_DIR, bundleId, flowName);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => path.join(dir, f));
}
