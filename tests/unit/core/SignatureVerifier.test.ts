import * as crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { SignatureVerifier } from '@electron/core/SignatureVerifier';

function sign(data: Buffer, privateKeyPem: string): Buffer {
  const key = crypto.createPrivateKey(privateKeyPem);
  return crypto.sign(null, data, key);
}

describe('SignatureVerifier', () => {
  let publicKeyPem: string;
  let privateKeyPem: string;

  beforeEach(() => {
    const pair = crypto.generateKeyPairSync('ed25519');
    publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
    privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  });

  it('valid signature passes', () => {
    const verifier = new SignatureVerifier(publicKeyPem);
    const data = Buffer.from('version: 1.0.0\nselectors:\n  login:\n    btn: "#login"', 'utf-8');
    const sig = sign(data, privateKeyPem);

    expect(verifier.verify(data, sig)).toBe(true);
  });

  it('valid signature passes with base64 string', () => {
    const verifier = new SignatureVerifier(publicKeyPem);
    const data = Buffer.from('hello world', 'utf-8');
    const sig = sign(data, privateKeyPem);

    expect(verifier.verify(data, sig.toString('base64'))).toBe(true);
  });

  it('tampered data fails', () => {
    const verifier = new SignatureVerifier(publicKeyPem);
    const original = Buffer.from('version: 1.0.0', 'utf-8');
    const sig = sign(original, privateKeyPem);
    const tampered = Buffer.from('version: 9.9.9', 'utf-8');

    expect(verifier.verify(tampered, sig)).toBe(false);
  });

  it('invalid signature fails', () => {
    const verifier = new SignatureVerifier(publicKeyPem);
    const data = Buffer.from('some data', 'utf-8');
    const fakeSig = crypto.randomBytes(64);

    expect(verifier.verify(data, fakeSig)).toBe(false);
  });

  it('garbage signature handled gracefully', () => {
    const verifier = new SignatureVerifier(publicKeyPem);
    const data = Buffer.from('some data', 'utf-8');

    expect(verifier.verify(data, 'not-valid-base64!!!')).toBe(false);
  });

  it('empty data with valid signature', () => {
    const verifier = new SignatureVerifier(publicKeyPem);
    const data = Buffer.alloc(0);
    const sig = sign(data, privateKeyPem);

    expect(verifier.verify(data, sig)).toBe(true);
  });

  it('wrong public key rejects valid signature', () => {
    const wrongPair = crypto.generateKeyPairSync('ed25519');
    const wrongPub = wrongPair.publicKey.export({ type: 'spki', format: 'pem' }) as string;

    const verifier = new SignatureVerifier(wrongPub);
    const data = Buffer.from('test', 'utf-8');
    const sig = sign(data, privateKeyPem);

    expect(verifier.verify(data, sig)).toBe(false);
  });
});
