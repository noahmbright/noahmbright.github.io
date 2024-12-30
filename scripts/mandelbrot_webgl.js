var webgl_mandelbrot_canvas = document.querySelector("#webgl-mandelcanvas");
var mandel_gl = webgl_mandelbrot_canvas.getContext("webgl");
if (!mandel_gl){
    console.log("Couldn't get webgl context");
}

const mandel_canvas_width = webgl_mandelbrot_canvas.width;
const mandel_canvas_height = webgl_mandelbrot_canvas.height;

// need uniforms for min/max x/y, canvas w/h
const mandel_vertex_shader_source= `
    precision highp float;

    attribute vec2 a_pos;

    void main(){
        gl_Position = vec4(a_pos, 0, 1.0);
    }
`

const mandel_fragment_shader_source= `
    precision highp float;

    uniform int h_pixels;
    uniform int w_pixels;
    uniform vec2 complex_min;
    uniform vec2 complex_max;
    uniform vec2 complex_delta;

    const int max_iterations = 10000;

    int iterate(in float real, in float imag){
        float re = real;
        float im = imag;

        for (int i = 0; i < max_iterations; i++){
            float re2 = re*re;
            float im2 = im*im;
            if (re2 + im2 > 4.0){
                return i;
            }

            float temp = re2 - im2 + real;
            im = 2.0 * re * im + imag;
            re = temp;
        }

        return max_iterations;
    }

    vec3 pallete(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d){
        return a + b*cos(6.28 * (c*t + d));
    }

    void main(){
        float f_w = float(w_pixels);
        float f_h = float(h_pixels);
        int iterations = iterate(gl_FragCoord.x / f_w * complex_delta.x + complex_min.x,
                                 gl_FragCoord.y / f_h * complex_delta.y + complex_min.y);

        float ratio = float(iterations)/float(max_iterations);

        vec3 a = vec3(0.1);
        vec3 b = vec3(0.75);
        vec3 c = vec3(40);
        vec3 d = vec3(0.1, 0.2, 0.05);

        if (iterations == max_iterations){
            gl_FragColor = vec4(vec3(0.0), 1.0);
        }
        else {
            gl_FragColor = vec4(pallete(float(ratio), a,b,c,d), 1.0);
        }
    }
`

function createShader(mandel_gl, type, source){
    var shader = mandel_gl.createShader(type);
    mandel_gl.shaderSource(shader, source);
    mandel_gl.compileShader(shader);
    var success = mandel_gl.getShaderParameter(shader, mandel_gl.COMPILE_STATUS);
    if (success){
        return shader;
    }

    console.log(mandel_gl.getShaderInfoLog(shader));
    mandel_gl.deleteShader(shader);
}

function createProgram(mandel_gl, vertex_shader, fragment_shader){
    var program = mandel_gl.createProgram();
    mandel_gl.attachShader(program, vertex_shader);
    mandel_gl.attachShader(program, fragment_shader);
    mandel_gl.linkProgram(program);
    var success = mandel_gl.getProgramParameter(program, mandel_gl.LINK_STATUS);
    if (success){
        return program;
    }

    console.log(mandel_gl.getProgramInfoLog(program));
    mandel_gl.deleteProgram(program);
}

const real_min0 = -1.5;
const real_max0 = 1.0;
const imag_min0 = -1.25;
const imag_max0 = 1.25;
const delta_real0 = real_max0 - real_min0;
const delta_imag0 = imag_max0 - imag_min0;
let real_min = -1.5;
let real_max = 1.0;
let imag_min = -1.25;
let imag_max = 1.25;
let delta_real = (real_max - real_min);
let delta_imag = (imag_max - imag_min);
const mandel_num_pixels = mandel_canvas_width * mandel_canvas_height;

var mandel_vertex_shader = createShader(mandel_gl, mandel_gl.VERTEX_SHADER, mandel_vertex_shader_source);
var mandel_fragment_shader = createShader(mandel_gl, mandel_gl.FRAGMENT_SHADER, mandel_fragment_shader_source);
var mandel_program = createProgram(mandel_gl, mandel_vertex_shader, mandel_fragment_shader);
mandel_gl.useProgram(mandel_program);

mandel_gl.viewport(0, 0, mandel_gl.canvas.width, mandel_gl.canvas.height);
const wPixelsLocation = mandel_gl.getUniformLocation(mandel_program, "w_pixels");
mandel_gl.uniform1i(wPixelsLocation, mandel_gl.canvas.width);
const hPixelsLocation = mandel_gl.getUniformLocation(mandel_program, "h_pixels");
mandel_gl.uniform1i(hPixelsLocation, mandel_gl.canvas.height);

const complexDelta = mandel_gl.getUniformLocation(mandel_program, "complex_delta");

const complexMinCoords = mandel_gl.getUniformLocation(mandel_program, "complex_min");
const complexMaxCoords = mandel_gl.getUniformLocation(mandel_program, "complex_max");

let mouseX;
let mouseY;
function mandel_set_mouse_position(e){
    const rect = webgl_mandelbrot_canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = rect.height - e.clientY + rect.top - 1;
}

webgl_mandelbrot_canvas.addEventListener("mousemove", mandel_set_mouse_position);

mandel_gl.clearColor(0.1, 0.0, 0.3, 0.3);

const mandel_positions = [
    -1.0, -1.0,
    -1.0, 1.0,
    1.0, 1.0,
    1.0, 1.0, // second
    1.0, -1.0,
    -1.0, -1.0
]

var mandel_positionAttributeLocation = mandel_gl.getAttribLocation(mandel_program, "a_pos");
var mandel_pos_buffer = mandel_gl.createBuffer();
mandel_gl.enableVertexAttribArray(mandel_pos_buffer);
mandel_gl.bindBuffer(mandel_gl.ARRAY_BUFFER, mandel_pos_buffer);
mandel_gl.bufferData(mandel_gl.ARRAY_BUFFER, new Float32Array(mandel_positions), mandel_gl.STATIC_DRAW);
mandel_gl.vertexAttribPointer(mandel_positionAttributeLocation, 2, mandel_gl.FLOAT, false, 0, 0);

const increment = 5.00e-3;
let zooming_in = true;

const zoom_threshold = 1e-5;
function render(){
    mandel_gl.uniform2f(complexMinCoords, real_min, imag_min);
    mandel_gl.uniform2f(complexMaxCoords, real_max, imag_max);
    mandel_gl.uniform2f(complexDelta, delta_real, delta_imag);

    mandel_gl.clear(mandel_gl.COLOR_BUFFER_BIT);
    mandel_gl.drawArrays(mandel_gl.TRIANGLES, 0, 6);

    if (zooming_in){
        const mandel_x_percentage = mouseX/mandel_canvas_width;
        const mandel_y_percentage = mouseY/mandel_canvas_height;
        const speed_multiplier = Math.atan(delta_imag/zoom_threshold);

        if (!Number.isNaN(mandel_x_percentage)){
            const real_speed = delta_real * increment * speed_multiplier;
            real_min = real_min + mandel_x_percentage * real_speed;
            real_max = real_max - (1.0 - mandel_x_percentage) * real_speed;
            delta_real = real_max - real_min;
        }


        if (!Number.isNaN(mandel_y_percentage)){
            const imag_speed = delta_imag * increment * speed_multiplier;
            imag_min = imag_min + mandel_y_percentage * imag_speed;
            imag_max = imag_max - (1.0 - mandel_y_percentage) * imag_speed;
            delta_imag = imag_max - imag_min;
        }
        if (imag_max - imag_min < zoom_threshold + 1e-6){
            zooming_in = false;
        }
    }

    if (!zooming_in){
        // zoomed in a lot, ready to zoom out
        // at this point real_min > real_min0, so real_min - real_min0 > 0
        // want to subtract off from real_min to get it closer to real_min0
        const speed= Math.atan(2*delta_imag/delta_imag0) * increment;
        real_min = real_min - (real_min - real_min0) * speed;
        real_max = real_max + (real_max0 - real_max) * speed;
        delta_real = real_max - real_min;

        imag_min = imag_min - (imag_min - imag_min0) * speed;
        imag_max = imag_max + (imag_max0 - imag_max) * speed;
        delta_imag = imag_max - imag_min;

        if (imag_max - imag_min > delta_imag0 - 1e-2){
            zooming_in = true;
        }
    }


    requestAnimationFrame(render);
}
requestAnimationFrame(render);
