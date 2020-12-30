import { KVStorageArea } from '@werker/cloudflare-kv-storage';

export const DEBUG = Boolean(Reflect.get(self, 'DEBUG') === 'true');
export const KV = Reflect.get(self, 'KV_NAMESPACE') as KVNamespace;
export const IP_SALT_KEY = 'IP_SALT';
export const WORKER_DOMAIN = Reflect.get(self, 'WORKER_DOMAIN');
export const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';
export const AUTH = Reflect.get(self, 'AUTH');
export const storage = new KVStorageArea('KV_NAMESPACE')