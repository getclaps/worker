import { UUID } from 'uuid-class';
import { Base64Encoder, Base64Decoder } from 'base64-encoding/mjs';

/** @param {UUID} uuid */
export const shortenId = (uuid) => new Base64Encoder({ urlFriendly: true }).encode(uuid.buffer);

/** @param {string} shortId */
export const elongateId = (shortId) => new UUID(new Base64Decoder().decode(shortId));
