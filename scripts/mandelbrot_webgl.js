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

    const int max_iterations = 50;

    int iterate(in float real, in float imag){
        float re = real;
        float im = imag;
        int iterations = 0;

        for (int i = 0; i < max_iterations; i++){
            if (re*re + im*im > 4.0){
                return i;
            }

            float temp = re * re - im * im + real;
            im = 2.0 * re * im + imag;
            re = temp;
        }

        return iterations;
    }

    void main(){
        float f_w = float(w_pixels);
        float f_h = float(h_pixels);
        int iterations = iterate(gl_FragCoord.x / f_w * complex_delta.x + complex_min.x,
                                 gl_FragCoord.y / f_h * complex_delta.y + complex_min.y);

        float f_iterations = float(iterations);
        float f_max_iterations = float(max_iterations);
        float ratio = f_iterations/f_max_iterations;

        if (iterations == max_iterations){
            gl_FragColor = vec4(0, 0, 0, 1.0);
        }
        else {
            gl_FragColor = vec4(vec3(sqrt(ratio)), 1.0);
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
    gl.deleteShader(shader);
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

const real_min = -1.5;
const real_max = 1.0;
const imag_min = -1.25;
const imag_max = 1.25;
const delta_real = (real_max - real_min);
const delta_imag = (imag_max - imag_min);
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

const complexMinCoords = mandel_gl.getUniformLocation(mandel_program, "complex_min");
mandel_gl.uniform2f(complexMinCoords, real_min, imag_min);

const complexMaxCoords = mandel_gl.getUniformLocation(mandel_program, "complex_max");
mandel_gl.uniform2f(complexMaxCoords, real_max, imag_max);

const complexDelta = mandel_gl.getUniformLocation(mandel_program, "complex_delta");
mandel_gl.uniform2f(complexDelta, delta_real, delta_imag);

mandel_gl.clearColor(0.1, 0.0, 0.3, 0.3);


const other_positions = [
    -0.5, -0.5,
    -0.5, 0.5,
    0.5, 0.5
    // second
    //1.0/2, 1.0/2,
    //1.0/2, -1.0/2,
    //-1.0/2, -1.0/2
]
const mandel_positions = [
    -1.0, -1.0,
    -1.0, 1.0,
    1.0, 1.0,
    // second
    1.0, 1.0,
    1.0, -1.0,
    -1.0, -1.0
]

var mandel_positionAttributeLocation = mandel_gl.getAttribLocation(mandel_program, "a_pos");
var mandel_pos_buffer = mandel_gl.createBuffer();
mandel_gl.enableVertexAttribArray(mandel_pos_buffer);
mandel_gl.bindBuffer(mandel_gl.ARRAY_BUFFER, mandel_pos_buffer);
mandel_gl.bufferData(mandel_gl.ARRAY_BUFFER, new Float32Array(mandel_positions), mandel_gl.STATIC_DRAW);
mandel_gl.vertexAttribPointer(mandel_positionAttributeLocation, 2, mandel_gl.FLOAT, false, 0, 0);

const fpsElement = document.querySelector("#fps");
var then = 0;
function render(now){
    mandel_gl.clear(mandel_gl.COLOR_BUFFER_BIT);
    mandel_gl.drawArrays(mandel_gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
