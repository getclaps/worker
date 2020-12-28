import { Base64Decoder, Base64Encoder } from 'base64-encoding';
import { Key } from './storage-area';

export const encodeKey = (key: Key): string => safeKeyToCompactString(keyToSafeKey(key));
export const decodeKey = (key: string): Key => compactStringToKey(key);

const TYPED_REP = /^(\w):/;
const SEPARATOR = '|';

const safeKeyToCompactString = (key: Key): string => {
  if (Array.isArray(key)) {
    return key.map(safeKeyToCompactString).join(SEPARATOR);
  }
  if (typeof key === 'string') {
    return key.match(TYPED_REP) || key.includes(SEPARATOR) 
      ? `s:${encodeURIComponent(key)}`
      : key
  }
  if (typeof key === 'number') {
    return `n:${key}`;
  }
  if (key instanceof Date) {
    return `d:${key.toISOString()}`;
  }
  if (key instanceof ArrayBuffer) {
    return `b:${new Base64Encoder().encode(key)}`
  }
}

const compactStringToKey = (key: string): Key => {
  const parts = key.split(SEPARATOR);
  if (parts.length === 1) return compactStringPartToKey(parts[0]);
  return parts.map(compactStringPartToKey);
}

const compactStringPartToKey = (part: string): Key => {
  const m = part.match(TYPED_REP);
  if (m) {
    const data = part.substr(2);
    switch (m[1]) {
      case 'n': return Number(data);
      case 'd': return new Date(data);
      case 'b': return new Base64Decoder().decode(data).buffer
      case 's': return decodeURIComponent(data);
    }
  } else {
    return part;
  }
}

// Copyright 2017 Jeremy Scheff
// <https://w3c.github.io/IndexedDB/#convert-a-value-to-a-key>
const keyToSafeKey = (input: Key, seen?: Set<object>): Key => {
    if (typeof input === "number") {
        if (isNaN(input)) {
            throw new Error();
        }
        return input;
    } else if (input instanceof Date) {
        const ms = input.valueOf();
        if (isNaN(ms)) {
            throw new Error();
        }
        return new Date(ms);
    } else if (typeof input === "string") {
        return input;
    } else if (
        input instanceof ArrayBuffer ||
        (typeof ArrayBuffer !== "undefined" &&
            ArrayBuffer.isView &&
            ArrayBuffer.isView(input))
    ) {
        if (input instanceof ArrayBuffer) {
            return new Uint8Array(input).buffer;
        }
        return new Uint8Array(input.buffer).buffer;
    } else if (Array.isArray(input)) {
        if (seen === undefined) {
            seen = new Set();
        } else if (seen.has(input)) {
            throw new Error();
        }
        seen.add(input);

        const keys = [];
        for (let i = 0; i < input.length; i++) {
            const hop = input.hasOwnProperty(i);
            if (!hop) {
                throw new Error();
            }
            const entry = input[i];
            const key = keyToSafeKey(entry, seen);
            keys.push(key);
        }
        return keys;
    } else {
        throw new Error();
    }
};
