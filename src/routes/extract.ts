import { UUID } from 'uuid-class';
import * as ipAddr from 'ipaddr.js';
import DeviceDetector, { DeviceDetectorResult } from "device-detector-js";
import { concatBufferSources } from 'typed-array-utils';

import { DEBUG, IP_SALT_KEY, KV } from '../constants';

async function getVisitor(ip: string, userAgent: string, hostname: string) {
  if (!ip) return null;
  try {
    const base = concatBufferSources(
      new Uint8Array(ipAddr.parse(ip).toByteArray()),
      new TextEncoder().encode(userAgent),
      new TextEncoder().encode(hostname), 
    );
    const dailyIPSalt = await KV.get(IP_SALT_KEY);
    return await UUID.v5(base, dailyIPSalt);
  } catch {
    return null;
  }
}

export async function extractData(headers: Headers, hostname: string) {
  const country = headers.get('cf-ipcountry');
  const connectingIP = headers.get('cf-connecting-ip');
  const userAgent = headers.get('user-agent');

  const visitor = await getVisitor(connectingIP, userAgent, hostname);

  let device: DeviceDetectorResult = null;
  if (!DEBUG) {
    try {
      const deviceDetector = new DeviceDetector({ skipBotDetection: true });
      device = deviceDetector.parse(userAgent);
    } catch (err) {}
  }

  return { country, visitor, device };
}
