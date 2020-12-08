export const DEBUG = Boolean(Reflect.get(self, 'DEBUG') === 'true');
export const KV_NAMESPACE = 'KV_NAMESPACE';
export const KV = Reflect.get(self, KV_NAMESPACE) as KVNamespace;
export const IP_SALT_KEY = 'IP_SALT';
export const WORKER_DOMAIN = Reflect.get(self, 'WORKER_DOMAIN');
export const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';

export const STRIPE_PUBLISHABLE_KEY = Reflect.get(self, 'STRIPE_PUBLISHABLE_KEY');
export const STRIPE_SECRET_KEY = Reflect.get(self, 'STRIPE_SECRET_KEY');
export const STRIPE_PRICE_ID = Reflect.get(self, 'STRIPE_PRICE_ID');
export const HAS_BILLING = !!STRIPE_PUBLISHABLE_KEY && !!STRIPE_SECRET_KEY && !!STRIPE_PRICE_ID;
