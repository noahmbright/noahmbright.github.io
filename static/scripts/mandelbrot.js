const real_min0 = -1.5;
const real_max0 = 1.0;
const imag_min0 = -1.25;
const imag_max0 = 1.25;

function update_fps(element, time, frames) {
    if (time === 0.0) {
        return;
    }
    const fps = 1000 * frames / time;
    element.textContent = fps.toFixed(2);
}

function new_config(name, iterator) {
    const canvas = document.getElementById(name + "Canvas");
    const ctx = canvas.getContext("2d");
    const image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
        time: 0.0,
        canvas: canvas,
        ctx: ctx,
        image_data: image_data,
        data: image_data.data,
        iterator: iterator,
        fps_element: document.getElementById(name + "-fps"),
    };
}

function new_bounds() {
    return {
        frames: 0,
        time: 0.0,
        real_min: real_min0,
        real_max: real_max0,
        imag_min: imag_min0,
        imag_max: imag_max0,
    };
}

const zoom_speed = 0.99;
function create_zoom_listener(canvas, bounds, draw_function) {
    let is_hovering = false;
    let mouse_percent_x = 0.5;
    let mouse_percent_y = 0.5;
    let last_time = performance.now();

    canvas.addEventListener('mouseenter', () => {
        last_time = performance.now();
        is_hovering = true;
        zoom();
    });

    canvas.addEventListener('mouseleave', () => {
        is_hovering = false;
    });


    function zoom() {
        if (!is_hovering || bounds.real_max - bounds.real_min < 1e-5) {
            return;
        }

        const t = performance.now();
        bounds.time += t - last_time;
        last_time = t;

        const delta_real = bounds.real_max - bounds.real_min;
        const delta_imag = bounds.imag_max - bounds.imag_min;

        // the complex number the mouse is hovered over
        const real = bounds.real_min + mouse_percent_x * delta_real;
        const imag = bounds.imag_max - mouse_percent_y * delta_imag;

        const next_delta_real = delta_real * zoom_speed;
        const next_delta_imag = delta_imag * zoom_speed;

        bounds.real_min = real - mouse_percent_x * next_delta_real;
        bounds.real_max = real + (1.0 - mouse_percent_x) * next_delta_real;
        bounds.imag_min = imag - (1.0 - mouse_percent_y) * next_delta_imag;
        bounds.imag_max = imag + mouse_percent_y * next_delta_imag;
        bounds.frames++;

        draw_function();
        requestAnimationFrame(zoom);
    }

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse_percent_x = (e.clientX - rect.left) / canvas.width;
        mouse_percent_y = (e.clientY - rect.top) / canvas.height;
    });
}

// vanilla JS implementations
const max_iterations_vanilla = 50;

// threading
const N_THREADS = navigator.hardwareConcurrency || 4;
const workers = [];
try {
    for (let k = 0; k < N_THREADS; k++) {
        workers.push(new Worker('/scripts/mandelbrot_worker.js'));
    }
} catch (e) { /* worker not available */ }

// color lookup table
const vanilla_palette = new Uint8Array(3 * (max_iterations_vanilla + 1));
for (let i = 0; i < max_iterations_vanilla; i++) {
    const t = i / max_iterations_vanilla;

    const a = [0.1, 0.1, 0.1];
    const b = [0.75, 0.75, 0.75];
    const c = [40, 40, 40];
    const d = [0.1, 0.2, 0.05];
    let color = [0.0, 0.0, 0.0];

    for (let j = 0; j < 3; j++) {
        color[j] = a[j] + b[j] * Math.cos(6.28 * (c[j] * t + d[j]));
    }

    vanilla_palette[3 * i + 0] = color[0] * 255;
    vanilla_palette[3 * i + 1] = color[1] * 255;
    vanilla_palette[3 * i + 2] = color[2] * 255;
}

vanilla_palette[3 * max_iterations_vanilla + 0] = 0;
vanilla_palette[3 * max_iterations_vanilla + 1] = 0;
vanilla_palette[3 * max_iterations_vanilla + 2] = 0;

////////////////// functional, using objects ////////////////// 
function new_complex_number(real, imag) {
    return { real: real, imag: imag };
}

function norm2(z) {
    return z.real * z.real + z.imag * z.imag;
}

function multiply_complex(z1, z2) {
    const real = z1.real * z2.real - z1.imag * z2.imag;
    const imag = z1.real * z2.imag + z1.imag * z2.real;
    return new_complex_number(real, imag);
}

function add_complex(z1, z2) {
    return new_complex_number(z1.real + z2.real, z1.imag + z2.imag);
}

function generate_mandelbrot_set_function(c) {
    return (z) => {
        const z1 = multiply_complex(z, z);
        return add_complex(z1, c);
    }
}

function functional_iterate(real, imag) {
    const c = new_complex_number(real, imag);
    const mandelfunc = generate_mandelbrot_set_function(c);
    let z = new_complex_number(0, 0);
    let iterations = 0;

    while (iterations < max_iterations_vanilla && norm2(z) < 4) {
        z = mandelfunc(z)
        iterations++;
    }

    return iterations;
}

////////////////// imperative implementation //////////////////
function imperative_iterate(real, imag) {
    let iterations = 0;
    let re = 0;
    let im = 0;
    let re2 = 0;
    let im2 = 0;

    while (iterations < max_iterations_vanilla && (re2 + im2 < 4)) {
        const temp_real = re2 - im2 + real;
        im = 2 * re * im + imag;
        re = temp_real;
        re2 = re * re;
        im2 = im * im;
        iterations++;
    }

    return iterations;
}

////////////////// vanilla driver //////////////////
const vanilla_bounds = new_bounds()
const functional_config = new_config("functional", functional_iterate);
const imperative_config = new_config("imperative", imperative_iterate);


function color_canvas(config, bounds) {
    const time0 = performance.now();

    const delta_real = (bounds.real_max - bounds.real_min) / config.canvas.width;
    const delta_imag = (bounds.imag_max - bounds.imag_min) / config.canvas.height;

    let c_im = bounds.imag_min;
    for (let j = config.canvas.height; j >= 0; j--) {
        let c_re = bounds.real_min;
        for (let i = 0; i < config.canvas.width; i++) {
            const iterations = config.iterator(c_re, c_im);

            const data_index = 4 * (j * config.canvas.width + i);
            const palette_index = 3 * iterations;
            config.data[data_index + 0] = vanilla_palette[palette_index + 0];
            config.data[data_index + 1] = vanilla_palette[palette_index + 1];
            config.data[data_index + 2] = vanilla_palette[palette_index + 2];
            config.data[data_index + 3] = 255;

            c_re += delta_real;
        }
        c_im += delta_imag;
    }

    config.ctx.putImageData(config.image_data, 0, 0);
    config.time += performance.now() - time0;
}

function draw_vanilla() {
    if ((vanilla_bounds.frames % 60) == 0) {
        update_fps(functional_config.fps_element, functional_config.time, vanilla_bounds.frames);
        update_fps(imperative_config.fps_element, imperative_config.time, vanilla_bounds.frames);
    }

    color_canvas(functional_config, vanilla_bounds)
    color_canvas(imperative_config, vanilla_bounds)
}

create_zoom_listener(functional_config.canvas, vanilla_bounds, draw_vanilla);
create_zoom_listener(imperative_config.canvas, vanilla_bounds, draw_vanilla);

////////////////// opengl //////////////////
function palette_source(c) {
    return `
    vec3 palette(in float t){
        vec3 a = vec3(0.1);
        vec3 b = vec3(0.75);
        vec3 c = vec3(${c});
        vec3 d = vec3(0.1, 0.2, 0.05);

        return a + b*cos(6.28 * (c*t + d));
    }
`
}

const fragment_shader_header = `#version 300 es
    precision highp float;

    in vec2 tex_coords;

    uniform int h_pixels;
    uniform int w_pixels;
    uniform vec2 complex_min;
    uniform vec2 complex_max;

    out vec4 frag_color;

    const uint max_iterations = 10000u;
`

const fragment_main = `
    void main(){
        float f_w = float(w_pixels);
        float f_h = float(h_pixels);
        vec2 complex_delta = complex_max - complex_min;
        uint iterations = iterate(gl_FragCoord.x / f_w * complex_delta.x + complex_min.x,
                                  gl_FragCoord.y / f_h * complex_delta.y + complex_min.y);

        float ratio = float(iterations)/float(max_iterations);

        if (iterations == max_iterations){
            frag_color = vec4(vec3(0.0), 1.0);
        }
        else {
            frag_color = vec4(palette(float(ratio)), 1.0);
        }
    }
`

const double_fragment_main = `
    void main(){
        vec2 f_w = vec2(gl_FragCoord.x / float(w_pixels), 0.0);
        vec2 f_h = vec2(gl_FragCoord.y / float(h_pixels), 0.0);
        f_w = vec2(tex_coords.x, 0.0);
        f_h = vec2(tex_coords.y, 0.0);


        // complex min is (min real, min imag)
        // complex max is (max real, max imag)
        vec2 double_min_imag = vec2(complex_min.y, complex_min_lo.y);
        vec2 double_min_real = vec2(complex_min.x, complex_min_lo.x);

        vec2 double_max_imag = vec2(complex_max.y, complex_max_lo.y);
        vec2 double_max_real = vec2(complex_max.x, complex_max_lo.x);

        vec2 complex_delta_real = double_subtract(double_max_real, double_min_real);
        vec2 complex_delta_imag = double_subtract(double_max_imag, double_min_imag);

        uint iterations = iterate(double_add(double_multiply(f_w, complex_delta_real), double_min_real),
                                  double_add(double_multiply(f_h, complex_delta_imag), double_min_imag));

        float ratio = float(iterations)/float(max_iterations);

        if (iterations == max_iterations){
            frag_color = vec4(vec3(0.0), 1.0);
        }
        else {
            frag_color = vec4(palette(float(ratio)), 1.0);
        }
    }
`

// need uniforms for min/max x/y, canvas w/h
const fragment_shader_source = `${fragment_shader_header}
    ${palette_source(40)}

    uint iterate(in float c_re, in float c_im){
        float re = c_re;
        float im = c_im;
        float re2 = re * re;
        float im2 = im * im;

        uint i = 0u;
        while (i < max_iterations && re2 + im2 < 4.0){
            float temp = re2 - im2 + c_re;
            im = 2.0 * re * im + c_im;
            re = temp;
            re2 = re * re;
            im2 = im * im;
            i++;
        }

        return i;
    }

    ${fragment_main}
`


let canvas = document.querySelector("#webgl-mandelcanvas");
const gl = get_webgl_context(canvas, "webgl2");

const program = create_and_link_shaders(gl, full_screen_triangle_vertex_shader_source, fragment_shader_source);
gl.useProgram(program);

gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
const wPixelsLocation = gl.getUniformLocation(program, "w_pixels");
gl.uniform1i(wPixelsLocation, gl.canvas.width);
const hPixelsLocation = gl.getUniformLocation(program, "h_pixels");
gl.uniform1i(hPixelsLocation, gl.canvas.height);

const complexMinCoords = gl.getUniformLocation(program, "complex_min");
const complexMaxCoords = gl.getUniformLocation(program, "complex_max");

//////////////////  double precision ////////////////// 
const double_precision_fragment_source = `${fragment_shader_header}
    ${palette_source(40)}
    ${double_precision_functions}

    uniform vec2 complex_min_lo;
    uniform vec2 complex_max_lo;

    uint iterate(in vec2 real, in vec2 imag){
        vec2 re = real;
        vec2 im = imag;

        for (uint i = 0u; i < max_iterations; i++){
            vec2 re2 = double_multiply(re, re);
            vec2 im2 = double_multiply(im, im);
            vec2 mag = double_add(re2, im2);

            if (mag.x > 4.0){
                return i;
            }

            vec2 temp = double_add(double_subtract(re2, im2), real);
            im = double_add(double_multiply(double_multiply(vec2(2.0, 0.0), re), im), imag);
            re = temp;
        }

        return max_iterations;
    }

    ${double_fragment_main}
`

//let double_canvas = document.querySelector("#double-canvas");
//const double_gl = get_webgl_context(double_canvas, "webgl2");
//
//const double_program = create_and_link_shaders(double_gl, full_screen_triangle_vertex_shader_source, double_precision_fragment_source);
//double_gl.useProgram(double_program);
//
//double_gl.viewport(0, 0, double_gl.canvas.width, double_gl.canvas.height);
//const double_wPixelsLocation = double_gl.getUniformLocation(double_program, "w_pixels");
//double_gl.uniform1i(double_wPixelsLocation, double_gl.canvas.width);
//const double_hPixelsLocation = double_gl.getUniformLocation(double_program, "h_pixels");
//double_gl.uniform1i(double_hPixelsLocation, double_gl.canvas.height);
//
//const double_complexMinCoords = double_gl.getUniformLocation(double_program, "complex_min");
//const double_complexMaxCoords = double_gl.getUniformLocation(double_program, "complex_max");
//const double_complex_min_lo = double_gl.getUniformLocation(double_program, "complex_min_lo");
//const double_complex_max_lo = double_gl.getUniformLocation(double_program, "complex_max_lo");


const mandelbrot_bounds = new_bounds();
function draw_mandelbrot_set() {
    gl.uniform2f(complexMinCoords, mandelbrot_bounds.real_min, mandelbrot_bounds.imag_min);
    gl.uniform2f(complexMaxCoords, mandelbrot_bounds.real_max, mandelbrot_bounds.imag_max);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function split_double(x) {
    const hi = Math.fround(x);
    const lo = x - hi;
    return [hi, lo];
}


//let double_time = 0.0;
//function draw_double_set() {
//    const time0 = performance.now();
//    const [real_max_hi, real_max_lo] = split_double(mandelbrot_bounds.real_max)
//    const [imag_max_hi, imag_max_lo] = split_double(mandelbrot_bounds.imag_max)
//    const [real_min_hi, real_min_lo] = split_double(mandelbrot_bounds.real_min)
//    const [imag_min_hi, imag_min_lo] = split_double(mandelbrot_bounds.imag_min)
//
//    double_gl.uniform2f(double_complexMinCoords, real_min_hi, imag_min_hi);
//    double_gl.uniform2f(double_complexMaxCoords, real_max_hi, imag_max_hi);
//    double_gl.uniform2f(double_complex_min_lo, real_min_lo, imag_min_lo);
//    double_gl.uniform2f(double_complex_max_lo, real_max_lo, imag_max_lo);
//    double_gl.drawArrays(double_gl.TRIANGLES, 0, 6);
//    double_time += performance.now() - time0;
//}

const mandelbrot_fps = document.getElementById("mandelbrot-fps");
const mandelbrot_zoom = document.getElementById("mandelbrot-zoom");

function draw_mandelbrot_sets() {
    if ((mandelbrot_bounds.frames % 60) == 0) {
        update_fps(mandelbrot_fps, mandelbrot_bounds.time, mandelbrot_bounds.frames);
        mandelbrot_zoom.textContent = (mandelbrot_bounds.real_max - mandelbrot_bounds.real_min);
    }

    draw_mandelbrot_set();
    //draw_double_set();
}

create_zoom_listener(canvas, mandelbrot_bounds, draw_mandelbrot_sets);
//create_zoom_listener(double_canvas, mandelbrot_bounds, draw_mandelbrot_sets);

//////////////////  julia sets ////////////////// 
const julia_max = 2;
const julia_min = -julia_max;
const julia_delta = julia_max - julia_min;
let julia_constant_real = 0.0;
let julia_constant_imag = 0.0;

// julia constant picker
const julia_constant_picker_canvas = document.getElementById("julia-constant-picker-canvas")
const julia_constant_ctx = julia_constant_picker_canvas.getContext("2d");
const julia_constant_real_span = document.getElementById("julia-constant-real");
const julia_constant_imag_span = document.getElementById("julia-constant-imag");
const julia_constant_picker_center_y = julia_constant_picker_canvas.height / 2;
const julia_constant_picker_center_x = julia_constant_picker_canvas.width / 2;
const julia_scale = 16; // how many pixels between gridlines

function draw_julia_constant_picker() {
    const num_gridlines = julia_constant_picker_canvas.height / julia_scale;
    const canvas = julia_constant_picker_canvas;
    const ctx = julia_constant_ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    ctx.lineWidth = 1;
    for (let i = -num_gridlines / 2 + 1; i < num_gridlines / 2; i++) {
        if (i === 0) {
            ctx.strokeStyle = '#000';
        } else {
            ctx.strokeStyle = '#ddd';
        }

        ctx.beginPath();
        ctx.moveTo(julia_constant_picker_center_x + i * julia_scale, 0);
        ctx.lineTo(julia_constant_picker_center_x + i * julia_scale, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, julia_constant_picker_center_y + i * julia_scale);
        ctx.lineTo(canvas.width, julia_constant_picker_center_y + i * julia_scale);
        ctx.stroke();
    }

    // translate complex coords to canvas coords
    const dot_x = (julia_constant_real - julia_min) / julia_delta * canvas.width;
    const dot_y = (julia_max - julia_constant_imag) / julia_delta * canvas.height;

    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.arc(dot_x, dot_y, 8, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    julia_constant_real_span.textContent = julia_constant_real.toFixed(2);
    julia_constant_imag_span.textContent = julia_constant_imag.toFixed(2);
}

const julia_bounds0 = {
    frames: 0,
    real_min: -2.0,
    real_max: 2.0,
    imag_min: -2.0,
    imag_max: 2.0,
};

const julia_bounds = { ...julia_bounds0 };

julia_constant_picker_canvas.addEventListener('click', (e) => {
    // number of pixels from top left in canvas
    const rect = julia_constant_picker_canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    julia_constant_real = x / julia_constant_picker_canvas.width * julia_delta - julia_max;
    julia_constant_imag = julia_max - y / julia_constant_picker_canvas.height * julia_delta;

    julia_gl.uniform2f(julia_constant_location, julia_constant_real, julia_constant_imag);

    Object.assign(julia_bounds, julia_bounds0);
    draw_julia_constant_picker()
    draw_julia_set();
});


const background_bounds = new_bounds()
const background_config = new_config("pickerBackground", imperative_iterate);
color_canvas(background_config, background_bounds);

// julia webgl
const julia_canvas = document.getElementById("julia-canvas")
const julia_gl = get_webgl_context(julia_canvas, "webgl2");


const julia_fragment_source = `${fragment_shader_header}
    uniform vec2 u_julia_constant;
    ${palette_source(300)}

    // uniform provides julia constant,
    // real and imag are z0 from frag coord
    uint iterate(in float real, in float imag){
        float re = real;
        float im = imag;
        float re2 = re * re;
        float im2 = im * im;

        uint i = 0u;
        while (i < max_iterations && re2 + im2 < 4.0){
            float temp = re2 - im2 + u_julia_constant.x;
            im = 2.0 * re * im + u_julia_constant.y;
            re = temp;
            re2 = re * re;
            im2 = im * im;
            i++;
        }

        return i;
    }

    ${fragment_main}
`

const julia_program = create_and_link_shaders(julia_gl, full_screen_triangle_vertex_shader_source, julia_fragment_source);
julia_gl.useProgram(julia_program);
julia_gl.viewport(0, 0, julia_gl.canvas.width, julia_gl.canvas.height);

const julia_w_pixels_location = julia_gl.getUniformLocation(julia_program, "w_pixels");
julia_gl.uniform1i(julia_w_pixels_location, julia_gl.canvas.width);

const julia_h_pixels_location = julia_gl.getUniformLocation(julia_program, "h_pixels");
julia_gl.uniform1i(julia_h_pixels_location, julia_gl.canvas.height);

const julia_min_coords = julia_gl.getUniformLocation(julia_program, "complex_min");
julia_gl.uniform2f(julia_min_coords, julia_min, julia_min);

const julia_max_coords_location = julia_gl.getUniformLocation(julia_program, "complex_max");
julia_gl.uniform2f(julia_max_coords_location, julia_max, julia_max);

const julia_constant_location = julia_gl.getUniformLocation(julia_program, "u_julia_constant");
julia_gl.uniform2f(julia_constant_location, julia_constant_real, julia_constant_imag);

function draw_julia_set() {
    julia_gl.uniform2f(julia_min_coords, julia_bounds.real_min, julia_bounds.imag_min);
    julia_gl.uniform2f(julia_max_coords_location, julia_bounds.real_max, julia_bounds.imag_max);
    julia_gl.drawArrays(julia_gl.TRIANGLES, 0, 6);
}

create_zoom_listener(julia_canvas, julia_bounds, draw_julia_set);

// main
draw_vanilla()
draw_julia_set();
draw_mandelbrot_set();
//draw_double_set();
draw_julia_constant_picker()

