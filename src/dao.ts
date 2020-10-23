import { UUID } from 'uuid-class';

export interface DAO {
  init(): Promise<void>;
  upsertDashboard(data: Dashboard): Promise<Dashboard>;
  getDashboard(id: UUID): Promise<Dashboard>;
  updateDomain(id: UUID, hostname: string): Promise<Dashboard>;
  relocateDashboard(oldId: UUID, newId: UUID): Promise<Dashboard>;
  updateClaps(data: ClapData, options: UpdateOptions): Promise<ClapCount>;
  getClaps({ hostname, href }: { href: string, hostname: string }): Promise<{ [href: string]: ClapCount }>;
  getClapsAndUpdateViews(data: ViewData, options: UpdateOptions): Promise<{ [href: string]: ClapCount }>;
  getStats(did: UUID, timeFrame: [number, TimeUnit]): Promise<StatsData>;
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
  href: string,
  hostname: string,
  country: string,
  visitor: UUID,
  referrer: string,
}

export interface UpdateOptions {
  ip: string | null, 
  dnt: boolean,
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

export type TimeUnit = 'day' | 'days' | 'half day' | 'half days' | 'hour' | 'hours' | 'minute' | 'minutes' | 'second' | 'seconds';
