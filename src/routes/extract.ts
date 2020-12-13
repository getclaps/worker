import { UUID } from 'uuid-class';
import * as ipAddr from 'ipaddr.js';
import DeviceDetector, { DeviceDetectorResult } from "device-detector-js";

import { DEBUG, IP_SALT_KEY, KV } from '../constants';

async function getVisitor(ip: string) {
  if (!ip) return null;
  try {
    const ipSalt = await KV.get(IP_SALT_KEY);
    const ipBase = new Uint8Array(ipAddr.parse(ip).toByteArray());
    return await UUID.v5(ipBase, ipSalt);
  } catch {
    return null;
  }
}

export async function extractData(headers: Headers) {
  const country = headers.get('cf-ipcountry');

  const visitor = await getVisitor(headers.get('cf-connecting-ip'));

  let device: DeviceDetectorResult = null;
  if (!DEBUG) {
    try {
      const deviceDetector = new DeviceDetector({ skipBotDetection: true });
      device = deviceDetector.parse(headers.get('user-agent'));
    } catch (err) {}
  }

  return { country, visitor, device };
}
