function new_complex_number(real, imag){
    return {real: real, imag: imag};
}

function norm(z){
    return z.real*z.real + z.imag*z.imag;
}

function multiply_complex(z1, z2){
    let real = z1.real * z2.real - z1.imag * z2.imag;
    let imag = z1.real * z2.imag + z1.imag* z2.real;
    return new_complex_number(real, imag);
}

function add_complex(z1, z2){
    return new_complex_number(z1.real + z2.real, z1.imag + z2.imag);
}

function generate_mandelbrot_set_function(c){
    return function ret_val(z) {
        let z1 = multiply_complex(z,z);
        return add_complex(z1, c);
    }
}

const MAX_ITERATIONS = 100;

function iterate_mandelfunc_under_0(c){

    const mandelfunc = generate_mandelbrot_set_function(c);

    let z = new_complex_number(0,0);
    let iterations = 0;

    while(iterations < MAX_ITERATIONS && norm(z) < 2){
        z = mandelfunc(z)
        iterations++;
    }

    return iterations;
}

function offset_in_element(e){
    var rect = e.target.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

}

let canvas = document.getElementById("mandelbrotCanvas");
let ctx = canvas.getContext("2d");

const PIXELS_W = ctx.canvas.clientWidth;
const PIXELS_H = ctx.canvas.clientHeight;
const ASPECT_RATIO = PIXELS_W/PIXELS_H;

const MIN_REAL = -1.5;
const MAX_REAL = 1.0;

const MIN_IMAG = -1.25;
const MAX_IMAG = 1.25;

const REAL_SPAN = MAX_REAL - MIN_REAL;
const IMAG_SPAN = MAX_IMAG - MIN_IMAG;

const DELTA_REAL = REAL_SPAN/PIXELS_W;
const DELTA_IMAG = IMAG_SPAN/PIXELS_H;

for (let i = 0; i<PIXELS_W; i++){
    for(let j = 0; j<PIXELS_H; j++){
        const c = new_complex_number(MIN_REAL + i * DELTA_REAL, MIN_IMAG + j*DELTA_IMAG);
        const iterations = iterate_mandelfunc_under_0(c);

        ctx.fillStyle = iterations === MAX_ITERATIONS ? '#000000' :  `hsl(${iterations} 50% 50%)`;
        //console.log(iterations);
        ctx.fillRect(i, j, 1, 1);
    }
}

// const c = new_complex_number(0.25, 0);
// let z = iterate_mandelfunc_under_0(c);
// console.log(z);
//console.log(WIDTH);
//console.log(HEIGHT);
