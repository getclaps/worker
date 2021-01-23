import { UUID } from 'uuid-class';
import { DeviceDetectorResult } from 'device-detector-js';

export interface DAO {
  init(): Promise<void>;
  getDashboards(): Promise<Dashboard[]>;
  cancelAll(toCancel: Dashboard[], toActivate?: Dashboard[]): Promise<void>;
  monthlyViews(hostname: string, date?: Date): Promise<number>;
  upsertDashboard(data: Dashboard): Promise<Required<Dashboard>>;
  tmpUpdateIP(id: UUID, ip: string): Promise<void>;
  getDashboard(id: UUID): Promise<Required<Dashboard> | null>;
  appendDomain(id: UUID, hostname: string): Promise<Required<Dashboard>>;
  removeDomain(id: UUID, hostname: string): Promise<Required<Dashboard>>;
  relocateDashboard(oldId: UUID, newId: UUID): Promise<Required<Dashboard>>;
  updateClaps(data: ClapData, options: UpdateOptions): Promise<ClapCount>;
  getClaps({ href }: { href: string }): Promise<{ [href: string]: ClapCount }>;
  getClapsAndUpdateViews(data: ViewData, options: UpdateOptions): Promise<{ [href: string]: ClapCount }>;
  getStats(did: UUID, timeFrame?: [number, TimeUnit]): Promise<StatsData>;
  getLog(did: UUID, timeFrame?: [number, TimeUnit]): Promise<LogEntry[]>;
  // resetUsage(): Promise<void>;
}

export interface Dashboard {
  id: UUID,
  hostname?: string[],
  active?: boolean,
  ip?: string,
  dnt?: boolean,
  [k: string]: any,
}

interface ViewDataLike {
  hostname: string,
  href: string,
  country?: string | null,
  visitor?: UUID | null,
  device?: DeviceDetectorResult | null,
}

export interface ClapData extends ViewDataLike {
  hash: string,
  id: UUID,
  claps: number,
  nonce: number,
}

export interface ViewData extends ViewDataLike {
  referrer?: string | null,
}

export interface UpdateOptions {
  ip: string | null,
  dnt: boolean,
  originHostname: string,
}

export interface ClapCount {
  claps: number
}

export interface StatsData {
  totalClaps: number,
  totalClappers: number,
  totalViews: number,
  visitors: number,
  views: { href: string, views: number }[],
  claps: { href: string, claps: number, clappers: number }[],
  countries: { country: string, views: number }[],
  referrals: { referrer: string, referrals: number }[],
}

export interface LogEntry {
  href: string,
  visitor: UUID,
  country: string,
  referrer: string,
  claps: number,
  ts: Date
}

export type TimeUnit = 'day' | 'days' | 'half day' | 'half days' | 'hour' | 'hours' | 'minute' | 'minutes' | 'second' | 'seconds';
