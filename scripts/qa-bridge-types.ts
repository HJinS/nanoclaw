export interface MaestroFlow {
  name: string;
  yaml: string;
}

export interface RunRequest {
  ipaPath: string;
  bundleId: string;
  flows: MaestroFlow[];
  deviceId?: string;
  runId: string;
}

export interface FlowResult {
  name: string;
  passed: boolean;
  durationMs: number;
  screenshotPaths: string[];
  error?: string;
}

export interface RegressionDiff {
  flowName: string;
  stepIndex: number;
  diffPercent: number;
  diffImagePath: string;
}

export interface RunResponse {
  runId: string;
  results: FlowResult[];
  regressionDiffs: RegressionDiff[];
  error?: string;
}

export interface BaselineSaveRequest {
  bundleId: string;
  flowName: string;
  screenshotPaths: string[];
}
