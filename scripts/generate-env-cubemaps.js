#!/usr/bin/env node
/**
 * generate-env-cubemaps.js
 *
 * Generates synthetic KTX1 IBL cubemaps for each ENVIRONMENT_PRESET from
 * the hand-tuned spherical harmonics (SH) coefficients.  The resulting
 * `.ibl.ktx` and `.skybox.ktx` files are placed under assets/environments/
 * and loaded by src/rendering/environment.js when quality is 'high' or
 * 'ultra'.
 *
 * These are SYNTHETIC cubemaps — they derive their colours entirely from the
 * same SH data used for diffuse lighting, so they provide view-dependent
 * specular colour variation (matching the existing diffuse environment
 * palette) but not sharp real-world reflections.  To get photorealistic
 * reflections, replace the generated files with proper HDR-based cubemaps
 * produced by Filament's cmgen tool (see assets/environments/README.md).
 *
 * Usage:
 *   node scripts/generate-env-cubemaps.js
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT_DIR   = join(REPO_ROOT, 'assets', 'environments')

// ────────────────────────────────────────────────────────────────────────────
// Environment presets (mirrors src/rendering/environment.js)
// ────────────────────────────────────────────────────────────────────────────
const ENVIRONMENT_PRESETS = {
    default: {
        sh: [
             1.10,  1.12,  1.28,
             0.18,  0.14,  0.06,
            -0.22, -0.20, -0.35,
             0.06,  0.06,  0.07,
             0.02,  0.02,  0.02,
             0.04,  0.03,  0.01,
            -0.02, -0.02, -0.03,
             0.03,  0.03,  0.02,
             0.01,  0.01,  0.01,
        ],
    },
    space_nebula: {
        sh: [
             0.15,  0.10,  0.35,
             0.04,  0.02,  0.08,
            -0.08, -0.06, -0.18,
             0.06,  0.04,  0.12,
             0.02,  0.01,  0.04,
             0.03,  0.02,  0.06,
            -0.01, -0.01, -0.02,
             0.02,  0.01,  0.04,
             0.01,  0.01,  0.02,
        ],
    },
    ice: {
        sh: [
             0.90,  0.95,  1.20,
             0.10,  0.12,  0.20,
            -0.18, -0.18, -0.30,
             0.06,  0.07,  0.10,
             0.02,  0.02,  0.03,
             0.02,  0.03,  0.04,
            -0.03, -0.03, -0.05,
             0.04,  0.04,  0.06,
             0.01,  0.01,  0.02,
        ],
    },
    volcanic: {
        sh: [
             0.40,  0.22,  0.10,
             0.35,  0.18,  0.04,
            -0.06, -0.04, -0.02,
             0.08,  0.05,  0.01,
             0.04,  0.02,  0.01,
             0.06,  0.03,  0.01,
            -0.04, -0.02, -0.01,
             0.02,  0.01,  0.00,
             0.02,  0.01,  0.00,
        ],
    },
    neon_city: {
        sh: [
             0.12,  0.08,  0.20,
             0.08,  0.02,  0.10,
            -0.04, -0.02, -0.06,
             0.06,  0.08,  0.12,
             0.03,  0.01,  0.05,
             0.05,  0.02,  0.08,
            -0.01, -0.01, -0.02,
             0.02,  0.01,  0.03,
             0.02,  0.01,  0.04,
        ],
    },
}

// ────────────────────────────────────────────────────────────────────────────
// SH evaluation
// ────────────────────────────────────────────────────────────────────────────

/** Evaluate 3-band (order-2) SH at a normalised direction (x, y, z). */
function evalSh3(sh, x, y, z) {
    const Y00  =  0.282095
    const Y1m1 =  0.488603 * y
    const Y10  =  0.488603 * z
    const Y11  =  0.488603 * x
    const Y2m2 =  1.092548 * x * y
    const Y2m1 =  1.092548 * y * z
    const Y20  =  0.315392 * (3 * z * z - 1)
    const Y21  =  1.092548 * x * z
    const Y22  =  0.546274 * (x * x - y * y)

    return [
        sh[0]  * Y00 + sh[3]  * Y1m1 + sh[6]  * Y10 + sh[9]  * Y11 +
        sh[12] * Y2m2 + sh[15] * Y2m1 + sh[18] * Y20 + sh[21] * Y21 + sh[24] * Y22,

        sh[1]  * Y00 + sh[4]  * Y1m1 + sh[7]  * Y10 + sh[10] * Y11 +
        sh[13] * Y2m2 + sh[16] * Y2m1 + sh[19] * Y20 + sh[22] * Y21 + sh[25] * Y22,

        sh[2]  * Y00 + sh[5]  * Y1m1 + sh[8]  * Y10 + sh[11] * Y11 +
        sh[14] * Y2m2 + sh[17] * Y2m1 + sh[20] * Y20 + sh[23] * Y21 + sh[26] * Y22,
    ].map(v => Math.max(0, v))
}

/** Blend SH towards the DC term (smoother / lower roughness mip). */
function evalSh3Blended(sh, x, y, z, t) {
    const dc = [sh[0], sh[1], sh[2]]
    const full = evalSh3(sh, x, y, z)
    return full.map((v, i) => v * (1 - t) + dc[i] * t * 0.282095 / 0.282095)
}

// ────────────────────────────────────────────────────────────────────────────
// Cubemap direction from face / pixel
// ────────────────────────────────────────────────────────────────────────────

/**
 * Return the normalised world-space direction for pixel (i, j) in
 * a cubemap face of size `size`.  Face ordering follows OpenGL conventions:
 * 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z.
 */
function cubeDir(face, i, j, size) {
    const sc = ((i + 0.5) / size) * 2 - 1  // [-1, 1]
    const tc = ((j + 0.5) / size) * 2 - 1  // [-1, 1]
    let x, y, z
    switch (face) {
        case 0:  x =  1;  y = -tc;  z = -sc;  break  // +X
        case 1:  x = -1;  y = -tc;  z =  sc;  break  // -X
        case 2:  x =  sc; y =  1;   z =  tc;  break  // +Y
        case 3:  x =  sc; y = -1;   z = -tc;  break  // -Y
        case 4:  x =  sc; y = -tc;  z =  1;   break  // +Z
        case 5:  x = -sc; y = -tc;  z = -1;   break  // -Z
    }
    const len = Math.sqrt(x * x + y * y + z * z)
    return [x / len, y / len, z / len]
}

// ────────────────────────────────────────────────────────────────────────────
// Cubemap image generation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate one mip level of a cubemap as an array of 6 Float32Arrays (RGB).
 *
 * @param {number[]} sh   - 27-element SH coefficient array
 * @param {number}   size - face width/height in texels
 * @param {number}   t    - blend-to-DC factor (0 = full SH, 1 = DC only)
 */
function generateMipLevel(sh, size, t) {
    const faces = []
    for (let face = 0; face < 6; face++) {
        const pixels = new Float32Array(size * size * 3)
        for (let j = 0; j < size; j++) {
            for (let i = 0; i < size; i++) {
                const [x, y, z] = cubeDir(face, i, j, size)
                const [r, g, b] = evalSh3Blended(sh, x, y, z, t)
                const idx = (j * size + i) * 3
                pixels[idx]     = r
                pixels[idx + 1] = g
                pixels[idx + 2] = b
            }
        }
        faces.push(pixels)
    }
    return faces
}

// ────────────────────────────────────────────────────────────────────────────
// KTX1 binary builder
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a KTX1 buffer containing a floating-point cubemap.
 *
 * @param {Array<Array<Float32Array>>} mipLevels
 *   Array indexed [mip][face], each face a Float32Array of RGB values.
 * @param {string} shMetadata  - Space-separated SH floats for the 'sh' key.
 * @returns {Buffer}
 */
function buildKtx1(mipLevels, shMetadata) {
    // ── Identifiers / constants ───────────────────────────────────────────
    const KTX_IDENTIFIER = Buffer.from([
        0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31,
        0xBB, 0x0D, 0x0A, 0x1A, 0x0A,
    ])
    const GL_FLOAT               = 0x1406
    const GL_RGB                 = 0x1907
    const GL_RGB32F              = 0x8815  // accepted by Filament IBL loader

    const numMips = mipLevels.length
    const baseSize = Math.round(Math.sqrt(mipLevels[0][0].length / 3))

    // ── Key-value data: 'sh' metadata ────────────────────────────────────
    // Format: keyAndValueByteSize (4 bytes), key\0, value, padding
    const shKeyStr   = 'sh\x00'          // null-terminated key
    const shValStr   = shMetadata + '\x00'
    const kvRaw      = shKeyStr + shValStr
    const kvRawLen   = Buffer.byteLength(kvRaw, 'utf8')
    const kvPadBytes = (4 - (kvRawLen % 4)) % 4
    const kvEntryLen = 4 + kvRawLen + kvPadBytes   // 4-byte size field + data + pad
    const bytesOfKVD = kvEntryLen

    // ── Header ───────────────────────────────────────────────────────────
    const HEADER_SIZE = 12 + 13 * 4  // identifier + 13 uint32 fields
    let totalSize = HEADER_SIZE + bytesOfKVD

    // Accumulate image data sizes
    const mipSizes = []
    for (let m = 0; m < numMips; m++) {
        const faceSize = mipLevels[m][0].byteLength  // Float32Array bytes
        const faceAndPad = (faceSize + 3) & ~3        // 4-byte aligned
        mipSizes.push({ faceSize, faceAndPad })
        totalSize += 4 + 6 * faceAndPad               // imageSize + 6 padded faces
    }

    const buf = Buffer.alloc(totalSize, 0)
    let pos = 0

    // ── Write identifier ─────────────────────────────────────────────────
    KTX_IDENTIFIER.copy(buf, pos);  pos += 12

    // ── Write header fields (little-endian UInt32) ───────────────────────
    function writeU32(v) { buf.writeUInt32LE(v, pos);  pos += 4 }

    writeU32(0x04030201)  // endianness
    writeU32(GL_FLOAT)    // glType
    writeU32(4)           // glTypeSize
    writeU32(GL_RGB)      // glFormat
    writeU32(GL_RGB32F)   // glInternalFormat
    writeU32(GL_RGB)      // glBaseInternalFormat
    writeU32(baseSize)    // pixelWidth
    writeU32(baseSize)    // pixelHeight
    writeU32(0)           // pixelDepth   (0 = cubemap / 2D)
    writeU32(0)           // numberOfArrayElements
    writeU32(6)           // numberOfFaces (cubemap)
    writeU32(numMips)     // numberOfMipmapLevels
    writeU32(bytesOfKVD)  // bytesOfKeyValueData

    // ── Write key-value data ─────────────────────────────────────────────
    buf.writeUInt32LE(kvRawLen, pos);  pos += 4  // keyAndValueByteSize
    buf.write(kvRaw, pos, 'utf8');     pos += kvRawLen
    pos += kvPadBytes                            // padding zeroes (already 0)

    // ── Write image data ─────────────────────────────────────────────────
    for (let m = 0; m < numMips; m++) {
        const { faceSize, faceAndPad } = mipSizes[m]
        buf.writeUInt32LE(faceSize, pos);  pos += 4   // imageSize = one face

        for (let f = 0; f < 6; f++) {
            const faceData = mipLevels[m][f]
            // Copy Float32Array bytes into buffer
            const faceBytes = Buffer.from(faceData.buffer, faceData.byteOffset, faceData.byteLength)
            faceBytes.copy(buf, pos);  pos += faceSize
            pos += faceAndPad - faceSize            // cubePadding
        }
    }

    return buf
}

// ────────────────────────────────────────────────────────────────────────────
// Main: generate KTX1 files for each preset
// ────────────────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })

const BASE_SIZE = 64  // face resolution for mip 0

for (const [envName, preset] of Object.entries(ENVIRONMENT_PRESETS)) {
    const sh = preset.sh

    // Build SH metadata string (27 floats, matches Filament's sh metadata)
    const shMeta = sh.map(v => v.toFixed(8)).join(' ')

    // ── Generate mip levels ──────────────────────────────────────────────
    // t=0 → full 3-band SH (sharpest specular detail we have)
    // t=1 → DC-only (fully diffuse / flat colour for roughest surfaces)
    const NUM_MIPS = Math.floor(Math.log2(BASE_SIZE)) + 1  // log2(64)+1 = 7

    const mipLevels = []
    for (let m = 0; m < NUM_MIPS; m++) {
        const size = BASE_SIZE >> m          // 64, 32, 16, 8, 4, 2, 1
        const t    = m / (NUM_MIPS - 1)     // 0 .. 1
        mipLevels.push(generateMipLevel(sh, size, t))
    }

    // ── Build and write IBL KTX1 ─────────────────────────────────────────
    const iblKtx1 = buildKtx1(mipLevels, shMeta)
    const iblPath = join(OUT_DIR, `${envName}.ibl.ktx`)
    writeFileSync(iblPath, iblKtx1)
    console.log(`[gen] ${iblPath}  (${(iblKtx1.length / 1024).toFixed(1)} KB)`)

    // ── Build and write Skybox KTX1 (mip 0 only, full size) ─────────────
    const skyKtx1 = buildKtx1([mipLevels[0]], shMeta)
    const skyPath = join(OUT_DIR, `${envName}.skybox.ktx`)
    writeFileSync(skyPath, skyKtx1)
    console.log(`[gen] ${skyPath}  (${(skyKtx1.length / 1024).toFixed(1)} KB)`)
}

console.log('\n✓  All synthetic KTX1 cubemaps written to assets/environments/')
console.log('  These provide SH-derived specular IBL for high/ultra quality.')
console.log('  For photorealistic reflections, replace them with cmgen output.')
console.log('  See assets/environments/README.md for instructions.')
