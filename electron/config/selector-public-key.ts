// ============================================================
// Selector Ed25519 Public Key — 远程 YAML 签名验证公钥
// ============================================================
//
// TODO: 部署前替换为真实公钥。
// 生成方法：
//   const crypto = require('crypto');
//   const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
//   const pubPem  = publicKey.export({ type: 'spki', format: 'pem' });
//   const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
// 将 privPem 保管在 CI 密钥管理器中，用以下命令生成签名文件：
//   const sig = crypto.sign('ed25519', Buffer.from(yamlContent), privPem);
//   fs.writeFileSync('platform.yaml.sig', sig.toString('base64'));
// ============================================================

export const SELECTOR_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAU2zgJY4QxKfMpeU1TGOpeqoTqO0/BujICt6F1A5ieIg=
-----END PUBLIC KEY-----` as const;
