import { UUID } from 'uuid-class';
import { Base64Encoder, Base64Decoder } from 'base64-encoding';

export const compressId = (uuid: UUID) => new Base64Encoder({ url: true }).encode(uuid);
export const elongateId = (shortId: string) => new UUID(new Base64Decoder().decode(shortId));
