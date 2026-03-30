const canvas = document.querySelector("#webgpuGameOfLifeCanvas");

const ASPECT_RATIO = canvas.height / canvas.width;
const GRID_WIDTH = 256;
const GRID_HEIGHT = GRID_WIDTH * ASPECT_RATIO;
const NUM_CELLS = GRID_WIDTH * GRID_HEIGHT;
const UPDATE_INTERVAL_MS = 100;
const WORKGROUP_SIZE = 8;
let generation = 0;

const cell_state_array = new Uint32Array(NUM_CELLS / 32);

for(let i = 0; i < NUM_CELLS; i++){
    const array_index = Math.trunc(i / 32);
    const bit_index = i % 32;
    cell_state_array[array_index] |= (Math.random() > 0.6 ? 1 : 0) << bit_index;
}

// FIXME don't like how I get a webgpu device and the webgpu context
// in different lines. They feel coupled. But I don't know about
// how to manage a one-to-many relationship between canvases and devices 
const device = await get_webgpu_device();
const context = canvas.getContext("webgpu");

//https://gpuweb.github.io/gpuweb/#dom-gpucanvascontext-configure
const canvas_format = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device: device,
    format: canvas_format,
});

// triangle-strip is GL triangle fan
 const vertices = new Float32Array([
//   X,    Y,
  -0.8, -0.8,
   0.8, -0.8,
   0.8,  0.8,

  -0.8, -0.8,
   0.8,  0.8,
  -0.8,  0.8,
]);

const vertex_buffer = device.createBuffer({
    label: "Cell vertices",
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertex_buffer, 0 /*buffer offset*/, vertices);

const vertex_buffer_layout = {
    arrayStride: 2 * 4,
    attributes: [{
        format: "float32x2",
        offset: 0, // how many bytes into the vertex buffer to start processing vertices at
        shaderLocation: 0
    }]
};

const cell_state_storage =[
    device.createBuffer({
        label: "Cell state storage A",
        size: cell_state_array.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
        label: "Cell state storage B",
        size: cell_state_array.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
];

device.queue.writeBuffer(cell_state_storage[0], 0 /*buffer offset*/, cell_state_array);

const uniform_array = new Float32Array([GRID_WIDTH, GRID_HEIGHT]);
const uniform_buffer = device.createBuffer({
    label: "Grid uniforms",
    size: uniform_array.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniform_buffer, 0, uniform_array);

const cell_shader_source = `
@group(0) @binding(0) var<uniform> grid_dimensions: vec2f;
@group(0) @binding(1) var<storage> cell_state: array<u32>;

struct VertexInput {
    @location(0) pos: vec2f,
    @builtin(instance_index) inst_idx: u32,
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) inst_idx: f32,
};

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    let i = f32(input.inst_idx);
    let cell = vec2f(i % grid_dimensions.x, floor(i / grid_dimensions.x));

    let grid_pos = (input.pos + 1.0) / grid_dimensions - 1 + cell / grid_dimensions * 2;
    var output: VertexOutput;
    output.pos = vec4f(grid_pos, 0.0, 1.0);
    output.inst_idx = i;
    return output;
}

// This location in the return says what render target to write to 
@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let i = input.inst_idx;
    let array_index: u32 = u32(i) / 32u;
    let bit_index: u32 = u32(i) % 32u;

    // Need to shift cell state right because I use state in the color calculation.
    // Only need it insofar as I want uniform colors.
    let state = (cell_state[array_index] >> bit_index) & 1u;
    let col = f32(state) * vec2f(0.7, 0.3);
    return vec4f(col, 0.8, 1.0);
}
`

const cell_shader_module = device.createShaderModule({
    label: "Cell shader",
    code: cell_shader_source,
});

const compute_source = `
@group(0) @binding(0) var<uniform> grid_dimensions: vec2f;
@group(0) @binding(1) var<storage> state_in: array<u32>;
@group(0) @binding(2) var<storage, read_write> state_out: array<atomic<u32>>; // NO WRITE ONLY MEMORY

fn check_set(x0: u32, y0: u32) -> u32 {

    let grid_x = u32(grid_dimensions.x);
    let grid_y = u32(grid_dimensions.y);

    let x = (x0 + grid_x) % grid_x;
    let y = (y0 + grid_y) % grid_y;

    let cell_index = y * grid_x + x;

    let array_index = cell_index / 32;
    let bit_index: u32 = cell_index % 32;
    let is_set = ((state_in[array_index] >> bit_index) & 1) == 1;

    return select(0u, 1u, is_set);
}

@compute
@workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
fn compute_main(@builtin(global_invocation_id) cell: vec3u){

    if (cell.x >= ${GRID_WIDTH} || cell.y >= ${GRID_HEIGHT}){
        return;
    }

    let k = check_set(cell.x - 1, cell.y - 1) 
          + check_set(cell.x - 1, cell.y + 0)
          + check_set(cell.x - 1, cell.y + 1)
          + check_set(cell.x - 0, cell.y - 1) 
          + check_set(cell.x - 0, cell.y + 0) * 9
          + check_set(cell.x - 0, cell.y + 1)
          + check_set(cell.x + 1, cell.y - 1) 
          + check_set(cell.x + 1, cell.y + 0)
          + check_set(cell.x + 1, cell.y + 1);

    let is_alive = (k == 3 || k == 11 || k == 12);

    let cell_index: u32 = cell.y * u32(grid_dimensions.x) + cell.x;
    let array_index = cell_index / 32;
    let bit_index = cell_index % 32;
    let mask: u32 = 1u << bit_index;

    atomicAnd(&state_out[array_index], ~mask);
    if(is_alive){
        atomicOr(&state_out[array_index], mask);
    }
}
`

const compute_shader_module = device.createShaderModule({
    label: "Cell shader",
    code: compute_source,
});

const bind_group_layout = device.createBindGroupLayout({
    label: "Bind group layout",
    entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: {}
    },
    {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
    },
    {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
    }]
});

// https://gpuweb.github.io/gpuweb/#gpupipelinelayout
// Using the same pipeline layout for many pipelines guarantees that
// there is no need for rebinding resources internally between those
// sharing pipelines.
//
// The expected usage of pipeline layouts is to put the less frequently
// changing bind groups at indices closer to 0. This saves the user agent(???)
// CPU time.
const pipeline_layout = device.createPipelineLayout({
    label: "cell pipeline layout",
    bindGroupLayouts: [ bind_group_layout ],
});


const cell_pipeline = device.createRenderPipeline({
    label: "Cell render pipeline",
    layout: pipeline_layout,
    vertex: {
        module: cell_shader_module,
        // entryPoint is optional to specify if there is only one @vertex
        entryPoint: "vertex_main",
        buffers: [vertex_buffer_layout]
    },
    fragment: {
        module: cell_shader_module,
        entryPoint: "fragment_main",
        targets: [{
            format: canvas_format
        }]
    },
});

const bind_groups = [
    device.createBindGroup({
        label: "cell renderer bind group A",
        layout: cell_pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: { buffer: uniform_buffer },
        }, {
            binding: 1,
            resource: { buffer: cell_state_storage[0] },
        }, {
            binding: 2,
            resource: { buffer: cell_state_storage[1] },
        }],
    }),
    device.createBindGroup({
        label: "cell renderer bind group B",
        layout: cell_pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: { buffer: uniform_buffer },
        }, {
            binding: 1,
            resource: { buffer: cell_state_storage[1] },
        }, {
            binding: 2,
            resource: { buffer: cell_state_storage[0] },
        }],
    }),
];


const sim_pipeline = device.createComputePipeline({
    label: "Sim compute pipeline",
    layout: pipeline_layout,
    compute: {
        module: compute_shader_module,
        entryPoint: "compute_main"
    },
});

function update_grid(){

    const encoder = device.createCommandEncoder();

    const compute_pass = encoder.beginComputePass();

    compute_pass.setPipeline(sim_pipeline);
    compute_pass.setBindGroup(0, bind_groups[generation % 2]);

    const workgroup_count = Math.ceil(NUM_CELLS / WORKGROUP_SIZE);
    compute_pass.dispatchWorkgroups(workgroup_count, workgroup_count);

    compute_pass.end();

    generation++;

    // https://gpuweb.github.io/gpuweb/#dom-gpucommandencoder-beginrenderpass
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear", // on loading the viewed texture, clear it
            clearValue: [ 0.0, 0.3, 0.6, 1.0 ],
            storeOp: "store", // on storing to the viewed texture, store
        }]
    })

    pass.setPipeline(cell_pipeline);
    pass.setVertexBuffer(0, vertex_buffer);
    pass.setBindGroup(0, bind_groups[generation % 2]);
    pass.draw(6, NUM_CELLS);
    pass.end();
    device.queue.submit([encoder.finish()])
}

setInterval(update_grid, UPDATE_INTERVAL_MS);
