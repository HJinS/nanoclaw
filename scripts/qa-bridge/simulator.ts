import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SimulatorDevice {
  udid: string;
  name: string;
  state: string;
}

export async function getBootedDevice(): Promise<SimulatorDevice | null> {
  const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices', '--json']);
  const data = JSON.parse(stdout) as { devices: Record<string, SimulatorDevice[]> };
  for (const devices of Object.values(data.devices)) {
    const booted = devices.find((d) => d.state === 'Booted');
    if (booted) return booted;
  }
  return null;
}

export async function bootDefaultDevice(): Promise<string> {
  const { stdout } = await execFileAsync('xcrun', [
    'simctl',
    'list',
    'devices',
    'available',
    '--json',
  ]);
  const data = JSON.parse(stdout) as { devices: Record<string, SimulatorDevice[]> };

  let targetUdid: string | null = null;
  for (const [runtime, devices] of Object.entries(data.devices)) {
    if (runtime.includes('iOS') && devices.length > 0) {
      const iphone = devices.find((d) => d.name.includes('iPhone'));
      if (iphone) {
        targetUdid = iphone.udid;
        break;
      }
    }
  }
  if (!targetUdid) throw new Error('No available iPhone simulator found');

  await execFileAsync('xcrun', ['simctl', 'boot', targetUdid]);
  return targetUdid;
}

export async function ensureBootedDevice(deviceId?: string): Promise<string> {
  if (deviceId && deviceId !== 'booted') return deviceId;
  const booted = await getBootedDevice();
  if (booted) return booted.udid;
  return bootDefaultDevice();
}

export async function installIpa(deviceUdid: string, ipaPath: string): Promise<void> {
  await execFileAsync('xcrun', ['simctl', 'install', deviceUdid, ipaPath]);
}

export async function launchApp(deviceUdid: string, bundleId: string): Promise<void> {
  await execFileAsync('xcrun', ['simctl', 'launch', deviceUdid, bundleId]);
}

export async function terminateApp(deviceUdid: string, bundleId: string): Promise<void> {
  await execFileAsync('xcrun', ['simctl', 'terminate', deviceUdid, bundleId]).catch(() => {
    // ignore if not running
  });
}

export async function uninstallApp(deviceUdid: string, bundleId: string): Promise<void> {
  await execFileAsync('xcrun', ['simctl', 'uninstall', deviceUdid, bundleId]).catch(() => {
    // ignore if not installed
  });
}
