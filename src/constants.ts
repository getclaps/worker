import { CFStorageArea } from '@werker/cloudflare-kv-storage';
export const IP_SALT_KEY = 'IP_SALT';
export const storage = new CFStorageArea('KV_NAMESPACE');