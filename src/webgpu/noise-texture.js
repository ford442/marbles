/**
 * Optional WebGPU compute noise texture (256×256 RGBA).
 * Used for procedural marble / surface variation when ?webgpuNoise=1.
 */

const NOISE_WGSL = `
struct Params { seed: f32, scale: f32, octaves: u32, pad: u32 };
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;

fn hash(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(127.1, 311.7)) + params.seed) * 43758.5453);
}

fn noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2<f32>(1.0, 0.0)), u.x),
        mix(hash(i + vec2<f32>(0.0, 1.0)), hash(i + vec2<f32>(1.0, 1.0)), u.x),
        u.y
    );
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(outputTex);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    let uv = vec2<f32>(gid.xy) / vec2<f32>(dims);
  var amp = 0.5;
  var freq = 1.0;
  var sum = 0.0;
  var norm = 0.0;
  for (var o = 0u; o < params.octaves; o++) {
    sum += noise(uv * params.scale * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  let v = sum / max(norm, 0.0001);
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(v, v, v, 1.0));
}
`;

const SIZE = 256;

/**
 * @param {GPUDevice} device
 * @param {{ seed?: number, scale?: number, octaves?: number }} [options]
 * @returns {Promise<ImageBitmap>}
 */
export async function generateNoiseTexture(device, options = {}) {
    const seed = options.seed ?? 42;
    const scale = options.scale ?? 8;
    const octaves = options.octaves ?? 4;

    const texture = device.createTexture({
        size: [SIZE, SIZE],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
    });

    const paramsBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const params = new ArrayBuffer(16);
    const view = new DataView(params);
    view.setFloat32(0, seed, true);
    view.setFloat32(4, scale, true);
    view.setUint32(8, octaves, true);
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const module = device.createShaderModule({ code: NOISE_WGSL });
    const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: paramsBuffer } },
            { binding: 1, resource: texture.createView() },
        ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(SIZE / 8), Math.ceil(SIZE / 8));
    pass.end();

    const bytesPerRow = SIZE * 4;
    const align = 256;
    const paddedBytesPerRow = Math.ceil(bytesPerRow / align) * align;
    const bufferSize = paddedBytesPerRow * SIZE;
    const readback = device.createBuffer({ size: bufferSize, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

    encoder.copyTextureToBuffer(
        { texture },
        { buffer: readback, bytesPerRow: paddedBytesPerRow },
        [SIZE, SIZE]
    );
    device.queue.submit([encoder.finish()]);

    await readback.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(readback.getMappedRange());
    const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++) {
        const srcRow = y * paddedBytesPerRow;
        const dstRow = y * bytesPerRow;
        pixels.set(mapped.subarray(srcRow, srcRow + bytesPerRow), dstRow);
    }
    readback.unmap();
    texture.destroy();
    paramsBuffer.destroy();

    return createImageBitmap(new ImageData(pixels, SIZE, SIZE));
}

/**
 * @param {object} game
 */
export async function tryInitWebGPUNoise(game) {
    if (!navigator.gpu || !game.webgpuParticles?.device) return null;
    try {
        const bitmap = await generateNoiseTexture(game.webgpuParticles.device);
        game.webgpuNoiseTexture = bitmap;
        console.log('[WebGPU] Procedural noise texture generated (256×256)');
        return bitmap;
    } catch (error) {
        console.warn('[WebGPU] Noise texture generation failed:', error);
        return null;
    }
}
