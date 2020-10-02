import { UUID } from 'uuid-class';
import { Base64Encoder, Base64Decoder } from 'base64-encoding';

export const shortenId = (uuid: UUID) => new Base64Encoder({ urlFriendly: true }).encode(uuid.buffer);
export const elongateId = (shortId: string) => new UUID(new Base64Decoder().decode(shortId));
