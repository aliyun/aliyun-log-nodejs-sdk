import { BinaryToTextEncoding } from 'crypto';
export declare function md5(input: Buffer | string, encoding?: BinaryToTextEncoding): string;
export declare function sha1(input: string, key: string, encoding?: BinaryToTextEncoding): string;
