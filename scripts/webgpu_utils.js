//| Purpose                    | WebGPU                                                    | Vulkan                                                         | OpenGL/WebGL                                       |
//| -------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
//| Instance                   | *Implicit in browser*                                     | `VkInstance`                                                   | *Implicit*                                         |
//| Physical Device            | `GPUAdapter`                                              | `VkPhysicalDevice`                                             | *Implicit, handled by driver*                      |
//| Logical Device             | `GPUDevice`                                               | `VkDevice`                                                     | *Implicit*                                         |
//| Surface / Context          | `GPUCanvasContext` from `canvas.getContext("webgpu")`     | `VkSurfaceKHR` via window system integration (WSI)             | `WebGLRenderingContext`, `WebGL2RenderingContext`  |
//| Swapchain                  | Implicit via `configure()`                                | Explicit `VkSwapchainKHR`                                      | Implicit in canvas                                 |
//| Queue                      | `GPUQueue` via `device.queue`                             | `VkQueue`                                                      | *Implicit*                                         |
//| Command Encoder            | `GPUCommandEncoder`                                       | `VkCommandBufferBeginInfo`, etc.                               | *Immediate mode (draw commands go straight to GL)* |
//| Render Pass                | `GPURenderPassEncoder`                                    | `VkRenderPass`, `VkFramebuffer`, `VkRenderPassBeginInfo`       | FBOs or default framebuffer                        |
//| Pipeline                   | `GPURenderPipeline` / `GPUComputePipeline`                | `VkPipeline`                                                   | Shader programs + fixed function state             |
//| Pipeline Layout / Bindings | `GPUPipelineLayout`, `GPUBindGroupLayout`, `GPUBindGroup` | `VkPipelineLayout`, `VkDescriptorSetLayout`, `VkDescriptorSet` | Uniforms and samplers set per-program or per-draw  |
//| Buffers                    | `GPUBuffer`                                               | `VkBuffer`                                                     | `WebGLBuffer`                                      |
//| Textures                   | `GPUTexture`, `GPUTextureView`                            | `VkImage`, `VkImageView`                                       | `WebGLTexture`                                     |
//| Samplers                   | `GPUSampler`                                              | `VkSampler`                                                    | `WebGLSampler` or sampler state in shaders         |
//| Shaders                    | `GPUShaderModule` (WGSL or SPIR-V)                        | `VkShaderModule` (SPIR-V)                                      | GLSL (compiled at runtime)                         |
//| Synchronization            | Implicit (device.queue.submit finishes in order)          | Explicit fences, semaphores                                    | Implicit and mostly hidden                         |

function get_webgpu_context(canvas){
    const gl = canvas.getContext("webgpu");
    if (!gl){
        console.log(`Couldn't get webgpu context`);
    }
    return gl;
}


async function init_webgpu(canvas, required_limits = {}){
    if (!navigator.gpu){
        throw new Error("WebGPU not supported in this browser");
    }

    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
    });
    if(!adapter){
        throw new Error("No GPU adapter found");
    }

    for (const [k, v] of Object.entries(required_limits)){
        const supported = adapter.limits[k];
        if (supported === undefined){
            throw new Error(`Required limit ${k} is not known to the adapter`);
        }
        if (v > supported){
            throw new Error(`Required limit ${k} exceeds adapter. Required: ${v}, supported: ${supported}`);
        }
    }

    const device = await adapter.requestDevice({ requiredLimits: required_limits });
    if(!device){
        throw new Error("No GPU device found");
    }

    const wgpu = get_webgpu_context(canvas);
    const canvas_format = navigator.gpu.getPreferredCanvasFormat();
    wgpu.configure({
        device: device,
        format: canvas_format,
        alphaMode: "opaque",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });

    return { device, wgpu, canvas_format };
}

async function create_and_check_shader_module(device, code, label = "shader"){
    const module = device.createShaderModule({code, label});

    if(module.compilationInfo){
        const info = await module.compilationInfo();
        const errors = info.messages.filter(m => m.type === "error");

        if (info.messages.length > 0) {
            console.group(`WGSL Compilation Log: ${label}`);
            for (const msg of info.messages) {
                const type = msg.type === "error" ? "❌" : msg.type === "warning" ? "⚠️" : "ℹ️";
                console.log(`${type} ${msg.lineNum}:${msg.linePos} - ${msg.message}`);
            }
            console.groupEnd();
        }

        if (errors.length > 0) {
            throw new Error(`Shader compilation failed for '${label}'`);
        }
    }
    else{
        console.warn("webgpu_utils.js: Shader compilation diagnostics not supported in this browser.");
    }

    return module;
}

async function init_fullscreen_quad(device, non_vertex_source, canvas_format, bind_group_layouts = []){
    const vertices = new Float32Array([
        -1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0,
         1.0, -1.0
    ]);

    const indices = new Uint16Array([
        0, 1, 2,
        0, 2, 3
    ]);

    const vertex_buffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });
    new Float32Array(vertex_buffer.getMappedRange()).set(vertices);
    vertex_buffer.unmap();

    const index_buffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    })
    new Uint16Array(index_buffer.getMappedRange()).set(indices);
    index_buffer.unmap();

    const pipeline_layout = device.createPipelineLayout({
        bindGroupLayouts: bind_group_layouts,
    });

    const shader_source = `
        ${non_vertex_source}

        @vertex
        fn vs_main(@location(0) pos: vec2<f32>) -> @builtin(position) vec4<f32>{
            return vec4(pos, 0.0, 1.0);
        }
    `;

    const shader_module = await create_and_check_shader_module(device, shader_source, "quad_shader");
    let pipeline;
    try{
        pipeline = device.createRenderPipeline({
            layout: pipeline_layout,
            vertex: {
                module: shader_module,
                entryPoint: "vs_main",
                buffers: [{
                    arrayStride: 2 * 4,
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x2"
                    }]
                }]
            },
            fragment: {
                module: shader_module,
                entryPoint: "fs_main",
                targets: [{ format: canvas_format }],
            },
            primitive: {
                topology: "triangle-list",
                stripIndexFormat: undefined
            },
        });
    }
    catch (e){
        console.error("Pipeline creation failed:", e);
        throw e; 
    }

    return { pipeline: pipeline, vertex_buffer: vertex_buffer, index_buffer: index_buffer};
}

function render_quad(device, wgpu, quad_info, bind_groups = []){
    const command_encoder = device.createCommandEncoder();
    const texture_view = wgpu.getCurrentTexture().createView();

    const GREEN = { r: 0.0, g: 1.0, b: 0.0, a: 1.0};
    const render_pass_descriptor = {
        colorAttachments: [{
            view: texture_view,
            clearValue: GREEN,
            loadOp: "clear",
            storeOp: "store",
        }],
    };

    const pass_encoder = command_encoder.beginRenderPass(render_pass_descriptor);
    pass_encoder.setPipeline(quad_info.pipeline);
    pass_encoder.setVertexBuffer(0, quad_info.vertex_buffer);
    pass_encoder.setIndexBuffer(quad_info.index_buffer, "uint16");

    for (let i = 0; i < bind_groups.length; i++){
        pass_encoder.setBindGroup(i, bind_groups[i]);
    }

    pass_encoder.drawIndexed(6);
    pass_encoder.end();
    device.queue.submit([command_encoder.finish()]);
}
