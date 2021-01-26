import { UUID } from 'uuid-class';
import * as ipAddr from 'ipaddr.js';
import DeviceDetector, { DeviceDetectorResult } from "device-detector-js";
import { concatBufferSources } from 'typed-array-utils';

import { IP_SALT_KEY, storage } from '../constants';

async function getVisitor(ip: string | null, userAgent: string | null, hostname: string | null) {
  if (!ip) return null;
  try {
    const base = concatBufferSources(
      new Uint8Array(ipAddr.parse(ip).toByteArray()),
      new TextEncoder().encode(userAgent ?? ''),
      new TextEncoder().encode(hostname ?? ''), 
    );
    const dailyIPSalt = new UUID(await storage.get<Uint8Array>(IP_SALT_KEY));
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

  let device: DeviceDetectorResult | null  = null;
  if (!DEBUG) {
    try {
      const deviceDetector = new DeviceDetector({ skipBotDetection: true });
      device = userAgent ? deviceDetector.parse(userAgent) : null;
    } catch (err) {}
  }

  return { country, visitor, device };
}
