(function() {
let canvas = document.querySelector("#pongCanvas");
let gl = canvas.getContext("webgl");
const pong_canvas_width = canvas.width;
const pong_canvas_height = canvas.height;
gl.viewport(0, 0, pong_canvas_width, pong_canvas_height);

let game_paused = true;
let between_rounds = true;

let player_score = 0;
let computer_score = 0;
const puck_speed = 2e-2;
const rando = Math.random();
const vx0 = puck_speed * Math.sin(Math.PI * rando);
const vy0 = puck_speed * Math.cos(Math.PI * rando);
const initial_x_offset = 0.1;
const player_paddle_speed_magnitude = 2e-2;
const computer_paddle_speed_magnitude = 2e-2;
const prob_computer_chases_ball = .85;

let player_paddle_height = 0.4;
let player_paddle_width = 0.05;
let player_paddle_pos = {x: -1.0 + initial_x_offset, y: 0.0};
let player_paddle_v = {vx: 0, vy: 0};

let computer_paddle_height = 0.4;
let computer_paddle_width = 0.05;
let computer_paddle_pos = {
    x: 1.0 - initial_x_offset - computer_paddle_width,
    y: 0.0
};
let computer_paddle_v = {vx: 0, vy: 0};

let ball_side_length = 0.1;
let ball_pos = {x: 0.0, y: 0.0};
let ball_v = {vx: 0, vy: 0};
const ball_x0 = -ball_side_length/2;
const ball_y0 = -ball_side_length/2;

const vertex_shader_source = `
    attribute vec2 a_pos;

    void main(){
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;

const fragment_shader_source = `
    precision mediump float;

    void main(){
        gl_FragColor = vec4(1.0);
    }
`;

const vertex_shader = createShader(gl, gl.VERTEX_SHADER, vertex_shader_source);
const fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);
const program = createProgram(gl, vertex_shader, fragment_shader);
gl.useProgram(program);

// let position of the paddles and ball be their top left corners
function paddle_collide(){
    
    const player_x_aligned = player_paddle_pos.x + player_paddle_width >= ball_pos.x
                          && ball_pos.x + ball_side_length >= player_paddle_pos.x;

    const player_y_aligned = player_paddle_pos.y - player_paddle_height <= ball_pos.y
                          && ball_pos.y - ball_side_length <= player_paddle_pos.y;

    if (player_x_aligned && player_y_aligned){
        let fraction_in_y = ((player_paddle_pos.y + ball_side_length) - ball_pos.y)/
                              (player_paddle_height + ball_side_length);
        if (fraction_in_y < 0.2){
            fraction_in_y = 0.2;
        }
        if (fraction_in_y > 0.8){
            fraction_in_y = 0.8;
        }

        ball_v.vx = puck_speed * Math.sin(Math.PI * fraction_in_y);
        ball_v.vy = puck_speed * Math.cos(Math.PI * fraction_in_y);
        return;
    }

    const computer_x_aligned = computer_paddle_pos.x + computer_paddle_width >= ball_pos.x
                          && ball_pos.x + ball_side_length >= computer_paddle_pos.x;

    const computer_y_aligned = computer_paddle_pos.y - computer_paddle_height <= ball_pos.y
                          && ball_pos.y - ball_side_length <= computer_paddle_pos.y;

    if (computer_x_aligned && computer_y_aligned){
        let fraction_in_y = ((computer_paddle_pos.y + ball_side_length) - ball_pos.y)/
                              (computer_paddle_height + ball_side_length);
        if (fraction_in_y < 0.2){
            fraction_in_y = 0.2;
        }
        if (fraction_in_y > 0.8){
            fraction_in_y = 0.8;
        }
        ball_v.vx = -puck_speed * Math.sin(Math.PI * fraction_in_y);
        ball_v.vy = puck_speed * Math.cos(Math.PI * fraction_in_y);
        return;
    }
}

const player_score_button = document.getElementById("pongPlayerScore");
const computer_score_button = document.getElementById("pongComputerScore");
function wall_collide(){
    if (ball_pos.y - ball_side_length <= -1.0 || ball_pos.y >= 1.0){
        ball_v.vy = -ball_v.vy;
    }

    if (ball_pos.x <= -1.0){
        computer_score++;
        computer_score_button.innerHTML = "Computer: " + computer_score.toString();
        ball_pos.x = ball_x0;
        ball_pos.y = ball_y0;
        ball_v.vx = 0;
        ball_v.vy = 0;
        between_rounds = true;
    }

    if (ball_pos.x + ball_side_length >= 1.0){
        player_score++;
        player_score_button.innerHTML = "Player: " + player_score.toString();
        ball_pos.x = ball_x0;
        ball_pos.y = ball_y0;
        ball_v.vx = 0;
        ball_v.vy = 0;
        between_rounds = true;
    }
}

function update_positions(dt){
    ball_pos.x += dt * ball_v.vx;
    ball_pos.y += dt * ball_v.vy;

    player_paddle_pos.x += dt * player_paddle_v.vx;
    player_paddle_pos.y += dt * player_paddle_v.vy;
    if (player_paddle_pos.y >= 1.0){
        player_paddle_pos.y = 1.0;
    }
    if (player_paddle_pos.y - player_paddle_height <= -1.0){
        player_paddle_pos.y = -1.0 + player_paddle_height;
    }

    computer_paddle_pos.x += dt * computer_paddle_v.vx;
    computer_paddle_pos.y += dt * computer_paddle_v.vy;
    if (computer_paddle_pos.y >= 1.0){
        computer_paddle_pos.y = 1.0;
    }
    if (computer_paddle_pos.y - computer_paddle_height <= -1.0){
        computer_paddle_pos.y = -1.0 + computer_paddle_height;
    }
}


function update_computer_paddle_velocity(){
    const x = Math.random();
    if (x < prob_computer_chases_ball){
        if (ball_pos.y > computer_paddle_pos.y){
            computer_paddle_v.vy = computer_paddle_speed_magnitude;
        }
        else {
            computer_paddle_v.vy = -computer_paddle_speed_magnitude;
        }
    }
    else {
        if (ball_pos.y < computer_paddle_pos.y){
            computer_paddle_v.vy = computer_paddle_speed_magnitude;
        }
        else {
            computer_paddle_v.vy = -computer_paddle_speed_magnitude;
        }
    }
}

// (x, y) is top left corner
// vertices are top left, top right, bottom left, bottom right
function make_quad(array, index, x, y, dx, dy){
    array[index + 0] = x;
    array[index + 1] = y;

    array[index + 2] = x + dx;
    array[index + 3] = y;

    array[index + 4] = x;
    array[index + 5] = y - dy ;

    array[index + 6] = x + dx;
    array[index + 7] = y - dy;
}

let positions = new Array(3 * 8);
let element_indices = [
    0, 1, 2, 2, 1, 3,
    4, 5, 6, 6, 5, 7,
    8, 9, 10, 10, 9, 11
];

const position_attribute_location = gl.getAttribLocation(program, "a_pos");
const pos_buffer = gl.createBuffer();
gl.enableVertexAttribArray(pos_buffer);
gl.bindBuffer(gl.ARRAY_BUFFER, pos_buffer);
gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);

const index_buffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(element_indices), gl.STATIC_DRAW);

gl.clearColor(0, 0, 0, 1);

document.addEventListener('keydown', (event)=> {
    switch(event.key){
        case 'ArrowUp':
            player_paddle_v.vy = player_paddle_speed_magnitude;
            break;
        case 'ArrowDown':
            player_paddle_v.vy = -player_paddle_speed_magnitude;
            break;
        case ' ':
            if (between_rounds){
                ball_v.vx = vx0;
                ball_v.vy = vy0;
                between_rounds = false;
                const rando = Math.random();
                ball_v.vx = puck_speed * Math.sin(Math.PI * rando);
                ball_v.vy = puck_speed * Math.cos(Math.PI * rando);
            }
            break;
        default:
            player_paddle_v.vy = 0;
    }

});

document.addEventListener('keyup', (event)=> {
    switch(event.key){
        case 'ArrowUp':
        case 'ArrowDown':
            player_paddle_v.vy = 0;
    }
});

let time_to_check = 500;
const control_factor = 50;
let time_elapsed = 0;
let prev_time = Date.now();
function render(){
    const current_time = Date.now();
    const dt = current_time - prev_time;
    prev_time = current_time;
    time_elapsed += dt;

    make_quad(positions, 0 * 8, ball_pos.x, ball_pos.y, ball_side_length, ball_side_length);
    make_quad(positions, 1 * 8, player_paddle_pos.x, player_paddle_pos.y, player_paddle_width, player_paddle_height);
    make_quad(positions, 2 * 8, computer_paddle_pos.x, computer_paddle_pos.y, computer_paddle_width, computer_paddle_height);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bufferData(gl. ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.drawElements(gl.TRIANGLES, 3 * 6, gl.UNSIGNED_SHORT, 0);

    const threshold = time_to_check - control_factor*(player_score - computer_score);
    if (time_elapsed > threshold){
        console.log(threshold);
        update_computer_paddle_velocity();
        time_elapsed = 0;
    }
    update_positions(1);
    paddle_collide();
    wall_collide();

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
})();
