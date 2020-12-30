// import { KVPacker } from '@werker/cloudflare-kv-storage';
// import msgpack from 'msgpack-lite';

// export class MsgPacker implements KVPacker {
//   pack(typeson: any): Uint8Array { 
//     return msgpack.encode(typeson);
//   }
//   async unpack(kv: KVNamespace, key: string) { 
//     const ab = await kv.get(key, 'arrayBuffer');
//     return ab && msgpack.decode(ab); 
//   }
// }
