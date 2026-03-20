#!/usr/bin/env node
/**
 * Twin Admin - License Key Generator
 *
 * Format: XXXX-XXXX-XXXX-XXXX-XXXX (25 chars, 5 groups of 4)
 * Uses base32-like charset (no ambiguous: 0/O, 1/I/L)
 * Checksum: last group validates previous groups
 *
 * Usage:
 *   node license-generator.js generate --product surgitwin --tier professional
 *   node license-generator.js validate <KEY>
 */

const crypto = require('crypto');

const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 32 chars, no 0/O 1/I/L
const GROUP_SIZE = 4;
const GROUPS = 5;
const KEY_LENGTH = GROUPS * GROUP_SIZE;
const SECRET = process.env.LICENSE_SECRET || 'twin-admin-license-secret-change-in-production';

function encodeSegment(bytes) {
  let result = '';
  let value = 0;
  for (const b of bytes) value = (value << 8) | b;
  for (let i = 0; i < GROUP_SIZE; i++) {
    result = CHARSET[value % CHARSET.length] + result;
    value = Math.floor(value / CHARSET.length);
  }
  return result;
}

function decodeSegment(segment) {
  let value = 0;
  for (const c of segment) {
    const idx = CHARSET.indexOf(c);
    if (idx === -1) return null;
    value = value * CHARSET.length + idx;
  }
  const bytes = [];
  for (let i = 0; i < 3; i++) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Buffer.from(bytes);
}

function checksum(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest().slice(0, 2);
}

/**
 * Generate a license key
 * @param {Object} opts
 * @param {string} opts.product - surgitwin | glowmorph | both
 * @param {string} opts.tier - starter | professional | enterprise | custom
 * @param {string} opts.licenseType - cloud_subscription | local_perpetual | local_subscription | trial
 * @param {number} [opts.maxDoctors]
 * @param {number} [opts.maxPatients]
 * @param {number} [opts.maxTwins]
 * @param {number} [opts.storageGb]
 * @param {number} [opts.gpuHoursPerMonth]
 * @param {Date} [opts.expiresAt]
 * @param {string} [opts.tenantId]
 */
function generate(opts) {
  const productCode = { surgitwin: 1, glowmorph: 2, both: 3 }[opts.product] || 1;
  const tierCode = { starter: 1, professional: 2, enterprise: 3, custom: 4 }[opts.tier] || 1;
  const typeCode = {
    cloud_subscription: 1,
    local_perpetual: 2,
    local_subscription: 3,
    trial: 4,
  }[opts.licenseType] || 2;

  const expiresAt = opts.expiresAt ? Math.floor(opts.expiresAt.getTime() / 1000) : 0;

  const payload = Buffer.alloc(20);
  let offset = 0;
  payload.writeUInt8(productCode, offset); offset += 1;
  payload.writeUInt8(tierCode, offset); offset += 1;
  payload.writeUInt8(typeCode, offset); offset += 1;
  payload.writeUInt16BE(opts.maxDoctors || 0, offset); offset += 2;
  payload.writeUInt16BE(opts.maxPatients || 0, offset); offset += 2;
  payload.writeUInt16BE(opts.maxTwins || 0, offset); offset += 2;
  payload.writeUInt16BE(opts.storageGb || 0, offset); offset += 2;
  payload.writeUInt16BE(Math.round((opts.gpuHoursPerMonth || 0) * 100), offset); offset += 2;
  payload.writeUInt32BE(expiresAt >>> 0, offset); offset += 4;
  payload.writeUInt32BE(crypto.randomBytes(4).readUInt32BE(0), offset); // nonce

  const cs = checksum(payload);
  const full = Buffer.concat([payload, cs]);

  const parts = [];
  for (let i = 0; i < full.length; i += 3) {
    parts.push(encodeSegment(full.slice(i, i + 3)));
  }

  return parts.join('-');
}

/**
 * Validate and decode a license key
 * @param {string} key
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
function validate(key) {
  const clean = key.replace(/-/g, '').toUpperCase();
  if (clean.length !== KEY_LENGTH) {
    return { valid: false, error: 'Invalid key length' };
  }

  const segments = key.split('-');
  if (segments.length !== GROUPS || segments.some((s) => s.length !== GROUP_SIZE)) {
    return { valid: false, error: 'Invalid key format' };
  }

  let full = Buffer.alloc(0);
  for (let i = 0; i < segments.length - 1; i++) {
    const decoded = decodeSegment(segments[i]);
    if (!decoded) return { valid: false, error: 'Invalid character in key' };
    full = Buffer.concat([full, decoded]);
  }

  const expectedCs = checksum(full);
  const actualCs = decodeSegment(segments[segments.length - 1]);
  if (!actualCs || !expectedCs.equals(actualCs)) {
    return { valid: false, error: 'Invalid checksum' };
  }

  let offset = 0;
  const productCode = full.readUInt8(offset); offset += 1;
  const tierCode = full.readUInt8(offset); offset += 1;
  const typeCode = full.readUInt8(offset); offset += 1;
  const maxDoctors = full.readUInt16BE(offset); offset += 2;
  const maxPatients = full.readUInt16BE(offset); offset += 2;
  const maxTwins = full.readUInt16BE(offset); offset += 2;
  const storageGb = full.readUInt16BE(offset); offset += 2;
  const gpuHoursPerMonth = full.readUInt16BE(offset) / 100; offset += 2;
  const expiresAt = full.readUInt32BE(offset);

  const product = { 1: 'surgitwin', 2: 'glowmorph', 3: 'both' }[productCode] || 'surgitwin';
  const tier = { 1: 'starter', 2: 'professional', 3: 'enterprise', 4: 'custom' }[tierCode] || 'starter';
  const licenseType = {
    1: 'cloud_subscription',
    2: 'local_perpetual',
    3: 'local_subscription',
    4: 'trial',
  }[typeCode] || 'local_perpetual';

  const now = Math.floor(Date.now() / 1000);
  if (expiresAt > 0 && expiresAt < now) {
    return { valid: false, error: 'License expired', payload: { product, tier, licenseType, expiresAt: new Date(expiresAt * 1000) } };
  }

  return {
    valid: true,
    payload: {
      product,
      tier,
      licenseType,
      maxDoctors: maxDoctors || null,
      maxPatients: maxPatients || null,
      maxTwins: maxTwins || null,
      storageGb: storageGb || null,
      gpuHoursPerMonth: gpuHoursPerMonth || null,
      expiresAt: expiresAt ? new Date(expiresAt * 1000) : null,
    },
  };
}

function keyHash(key) {
  return crypto.createHash('sha256').update(key.replace(/-/g, '').toUpperCase()).digest('hex');
}

function keyPrefix(key) {
  return key.replace(/-/g, '').toUpperCase().slice(0, 8);
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'generate') {
    const getOpt = (name) => {
      const i = args.indexOf('--' + name);
      return i >= 0 ? args[i + 1] : undefined;
    };
    const key = generate({
      product: getOpt('product') || 'surgitwin',
      tier: getOpt('tier') || 'professional',
      licenseType: getOpt('type') || 'local_perpetual',
      maxDoctors: parseInt(getOpt('doctors'), 10),
      maxPatients: parseInt(getOpt('patients'), 10),
      maxTwins: parseInt(getOpt('twins'), 10),
      storageGb: parseInt(getOpt('storage'), 10),
      gpuHoursPerMonth: parseFloat(getOpt('gpu')),
      expiresAt: getOpt('expires') ? new Date(getOpt('expires')) : undefined,
    });
    console.log('License key:', key);
    console.log('Hash (for DB):', keyHash(key));
    console.log('Prefix (for lookup):', keyPrefix(key));
  } else if (cmd === 'validate' && args[1]) {
    const result = validate(args[1]);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Usage:');
    console.log('  node license-generator.js generate --product surgitwin --tier professional [--type local_perpetual] [--doctors 10] [--twins 100] [--storage 500] [--gpu 50] [--expires 2026-12-31]');
    console.log('  node license-generator.js validate <KEY>');
  }
}

module.exports = { generate, validate, keyHash, keyPrefix };
