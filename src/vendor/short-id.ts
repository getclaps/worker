import { UUID } from 'uuid-class';
import { Base64Encoder, Base64Decoder } from 'base64-encoding';

export const shortenId = (uuid: UUID) => new Base64Encoder({ url: true }).encode(uuid);
export const parseUUID = (s?: string | null) => s &&
  (s.length === 22 || s.length == 24 && s.endsWith('==') 
    ? new UUID(new Base64Decoder().decode(s).buffer)
    : new UUID(s))
