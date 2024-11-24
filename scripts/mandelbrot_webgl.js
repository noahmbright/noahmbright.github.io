var webgl_mandelbrot_canvas = document.querySelector("#webgl-mandelcanvas");
var gl = webgl_mandelbrot_canvas.getContext("webgl");
if (!gl){
    console.log("Couldn't get webgl context");
}

const mandel_canvas_width = webgl_mandelbrot_canvas.width;
const mandel_canvas_height = webgl_mandelbrot_canvas.height;

// need uniforms for min/max x/y, canvas w/h
const vertex_shader_source= `
    precision mediump float;

    void main(){
    }
`

const fragment_shader_source= `
    precision mediump float;

    uniform int h_pixels;
    uniform int w_pixels;
    uniform vec2 complex_min;
    uniform vec2 complex_max;

    const int max_iterations = 20;

    int iterate(in float real, in float imag){
        float re = real;
        float im = imag;
        int iterations = 0;


        for (int i = 0; i <= max_iterations; i++){
            if (re*re + im*im > 4.0){
                break;
            }

            float temp = re * re - im * im + real;
            im = 2.0 * re * im + imag;
            re = temp;
            iterations = i;
        }

        return iterations;
    }

    void main(){

        float delta_real = complex_max.x - complex_min.x;
        float delta_imag = complex_max.y - complex_min.y;
      
        float f_w = float(w_pixels);
        float f_h = float(h_pixels);
        int iterations = iterate(gl_FragCoord.x / f_w * delta_real + complex_min.x,
                                 gl_FragCoord.y / f_h * delta_imag + complex_min.y);

        float f_iterations = float(iterations);
        float f_max_iterations = float(max_iterations);
        float ratio = f_iterations/f_max_iterations;

        if (iterations == max_iterations){
            gl_FragColor = vec4(0, 0, 0, 1.0);
        } else {
            gl_FragColor = vec4(vec3(sqrt(ratio)), 1.0);
        }
    }
`

function createShader(gl, type, source){
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success){
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertex_shader, fragment_shader){
    var program = gl.createProgram();
    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success){
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

const real_min = -1.5;
const real_max = 1.0;
const imag_min = -1.25;
const imag_max = 1.25;
const delta_real = (real_max - real_min)/mandel_canvas_width;
const delta_imag = (imag_max - imag_min)/mandel_canvas_height;

var vertex_shader = createShader(gl, gl.VERTEX_SHADER, vertex_shader_source);
var fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);
var program = createProgram(gl, vertex_shader, fragment_shader);
gl.useProgram(program);

var position_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);

const mandel_num_pixels = mandel_canvas_width * mandel_canvas_height;
var positions = Array(2*mandel_num_pixels).fill(0);


for(i = 0; i < mandel_num_pixels; i++){
    positions[i] =       ( i % mandel_canvas_width ) * 2.0/mandel_canvas_width - 1;
    positions[2*i + 1] = ( i / mandel_canvas_width ) * 2.0/mandel_canvas_height - 1;
}

gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

// todo: resize canvas

gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
const wPixelsLocation = gl.getUniformLocation(program, "w_pixels");
gl.uniform1i(wPixelsLocation, gl.canvas.width);
const hPixelsLocation = gl.getUniformLocation(program, "h_pixels");
gl.uniform1i(hPixelsLocation, gl.canvas.height);

const complexMinCoords = gl.getUniformLocation(program, "complex_min");
gl.uniform2f(complexMinCoords, real_min, imag_min);

const complexMaxCoords = gl.getUniformLocation(program, "complex_max");
gl.uniform2f(complexMaxCoords, real_max, imag_max);

var positionAttributeLocation = gl.getAttribLocation(program, "a_pos");

gl.clearColor(0.1, 0.0, 0.3, 0.3);
gl.enableVertexAttribArray(positionAttributeLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

const fpsElement = document.querySelector("#fps");
var then = 0;
function render(now){
    //gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, mandel_num_pixels);

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
