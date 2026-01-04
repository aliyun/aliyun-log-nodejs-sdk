import crypto, { BinaryToTextEncoding } from 'crypto';

export function md5(input: Buffer | string, encoding: BinaryToTextEncoding = 'hex'): string {
  return crypto.createHash('md5').update(input).digest(encoding);
}

export function sha1(input: string, key: string, encoding: BinaryToTextEncoding = 'binary'): string {
  return crypto.createHmac('sha1', key).update(input).digest(encoding);
}
