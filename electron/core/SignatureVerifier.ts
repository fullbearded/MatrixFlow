import * as crypto from 'crypto';
import { SELECTOR_ED25519_PUBLIC_KEY } from '../config/selector-public-key';
import { Logger } from './Logger';

const logger = new Logger('SignatureVerifier');

export class SignatureVerifier {
  private readonly keyObject: crypto.KeyObject;

  constructor(publicKeyPem?: string) {
    const pem = publicKeyPem ?? SELECTOR_ED25519_PUBLIC_KEY;
    this.keyObject = crypto.createPublicKey(pem);
  }

  verify(data: Buffer, signature: Buffer | string): boolean {
    try {
      const sigBuffer =
        typeof signature === 'string'
          ? Buffer.from(signature, 'base64')
          : signature;

      return crypto.verify(null, data, this.keyObject, sigBuffer);
    } catch (err) {
      logger.warn('签名验证异常:', (err as Error).message);
      return false;
    }
  }
}

export const signatureVerifier = new SignatureVerifier();
