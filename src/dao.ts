import { UUID } from 'uuid-class';

export interface DAO {
  init(): Promise<void>;
  upsertDashboard(data: Dashboard): Promise<Dashboard>;
  getDashboard(id: UUID): Promise<Dashboard>;
  updateDomain(id: UUID, hostname: string): Promise<Dashboard>;
  addDomain(id: UUID, hostname: string): Promise<Dashboard>;
  removeDomain(id: UUID, hostname: string): Promise<Dashboard>;
  relocateDashboard(oldId: UUID, newId: UUID): Promise<Dashboard>;
  updateClaps(data: ClapData, options: UpdateOptions): Promise<ClapCount>;
  getClaps({ href }: { href: string }): Promise<{ [href: string]: ClapCount }>;
  getClapsAndUpdateViews(data: ViewData, options: UpdateOptions): Promise<{ [href: string]: ClapCount }>;
  getStats(did: UUID, timeFrame?: [number, TimeUnit]): Promise<StatsData>;
  getLog(did: UUID, timeFrame?: [number, TimeUnit]): Promise<LogEntry[]>;
}

export interface Dashboard {
  id: UUID,
  customer?: string,
  subscription?: string,
  hostname?: string,
  active?: boolean,
  ip?: string,
  dnt?: boolean,
}

export interface ClapData {
  hostname: string,
  href: string,
  hash: string,
  id: UUID,
  visitor: UUID,
  claps: number,
  nonce: number,
  country: string,
}

export interface ViewData {
  hostname: string,
  href: string,
  country: string,
  visitor: UUID,
  referrer: string,
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
  claps: number,
  ts: Date
}

export type TimeUnit = 'day' | 'days' | 'half day' | 'half days' | 'hour' | 'hours' | 'minute' | 'minutes' | 'second' | 'seconds';
