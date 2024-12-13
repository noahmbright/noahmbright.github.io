(function() {
    let canvas = document.querySelector("#gameOfLifeCanvas");
    let gl = canvas.getContext("webgl");
    if(!gl){
        console.log("Couldn't get webgl context");
    }
    const height = canvas.height;
    const width = canvas.width;

    // game of life
    let generation = 0;
    const pixels_per_cell = 16;
    const gol_height = Math.floor(canvas.height/pixels_per_cell);
    const gol_width = Math.floor(canvas.width/pixels_per_cell);
    const dx = 2.0/gol_width;
    const dy = 2.0/gol_height;

    let gol_board = new Array(gol_height * gol_width).fill(0);
    for (let x = 0; x<gol_width; x++){
        gol_board[gol_width * gol_height / 2 + x] = 1;
    }

    const kernel = [
        1, 1, 1,
        1, 0, 1,
        1, 1, 1
    ];

    // do processing on GPU with texture
    function create_texture(gl){
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        return texture;
    }

    const texture1 = create_texture(gl);
    const texture2 = create_texture(gl);
    const fbo1 = gl.createFramebuffer();
    const fbo2 = gl.createFramebuffer();
    framebuffers = [fbo1, fbo2];
    textures = [texture1, texture2];

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE,
        gol_width, gol_height, 0, gl.LUMINANCE,
        gl.UNSIGNED_BYTE, new Uint8Array(gol_board));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture1, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // shaders
    const vertex_shader_source = `
        attribute vec2 a_pos;
        attribute vec2 a_tex_coord;
        varying vec2 v_tex_coord;

        void main(){
            gl_Position = vec4(a_pos, 0, 1.0);
            v_tex_coord = a_tex_coord;
        }
    `
    const fragment_shader_source = `
        precision mediump float;
        uniform vec4 u_color;
        uniform float u_kernel[9];
        uniform vec2 u_board_size;
        uniform sampler2D u_board;
        varying vec2 v_tex_coord;

        void main(){
            gl_FragColor = u_color;
            vec2 one_pixel = vec2(1.0, 1.0) / u_board_size;

            // want this to be the pixel we're updating
            int current = 1;
            // get sum of alive neighbors
            vec4 sum_vec = 
                texture2D(u_board, v_tex_coord + one_pixel * vec2(-1.0, -1.0)) * u_kernel[0] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2( 0.0, -1.0)) * u_kernel[1] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2( 1.0, -1.0)) * u_kernel[2] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2(-1.0,  0.0)) * u_kernel[3] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2( 0.0,  0.0)) * u_kernel[4] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2( 1.0,  0.0)) * u_kernel[5] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2(-1.0,  1.0)) * u_kernel[6] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2( 0.0,  1.0)) * u_kernel[7] +
                texture2D(u_board, v_tex_coord + one_pixel * vec2( 1.0,  1.0)) * u_kernel[8];

            int sum = int(sum_vec.r);
            if (current == 1){
                if (!(sum == 2 || sum == 3)){
                    current = 0;
                    gl_FragColor = vec4(vec3(0.8), 1.0);
                }
            }
            else{
                if (sum == 3){
                    current = 1;
                    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
                }
            }
        }
    `

    const lines_vertex_shader_source = `
        attribute vec2 a_pos;

        void main(){
            gl_Position = vec4(a_pos, 0.0, 1.0);
        }
    `

    const lines_fragment_shader_source = `
        precision mediump float;
        uniform vec4 u_color;
        void main(){
            gl_FragColor = u_color;
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
    
    let vertex_shader = createShader(gl, gl.VERTEX_SHADER, vertex_shader_source);
    let fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);
    let program = createProgram(gl, vertex_shader, fragment_shader);

    let lines_vertex_shader = createShader(gl, gl.VERTEX_SHADER, lines_vertex_shader_source);
    let lines_fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, lines_fragment_shader_source);
    let lines_program = createProgram(gl, lines_vertex_shader, lines_fragment_shader);
    // done with shaders

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    // draw square background
    const square_vertices = [
        -1, -1,
        -1, 1,
        1, 1,
        -1, -1,
        1, -1,
        1, 1
    ];

    const texture_coords = [
        0, 0,
        0, 1,
        1, 1,
        0, 0,
        1, 0,
        1, 1
    ];

    let position_attribute_location = gl.getAttribLocation(program, "a_pos");
    let pos_buffer = gl.createBuffer();
    gl.enableVertexAttribArray(pos_buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, pos_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(square_vertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);

    let texture_coords_attribute_location = gl.getAttribLocation(program, "a_pos");
    let tex_coords_buffer = gl.createBuffer();
    gl.enableVertexAttribArray(pos_buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, tex_coords_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture_coords), gl.STATIC_DRAW);
    gl.vertexAttribPointer(texture_coords_attribute_location, 2, gl.FLOAT, false, 0, 0);

    // draw gridlines
    let grid_vertices = [];
    // horizontal lines of constant y
    for (let y = -1; y<1.0; y+=dy){
        grid_vertices.push(-1.0);
        grid_vertices.push(y);
        grid_vertices.push(1.0);
        grid_vertices.push(y);
    }
    // vertical lines of constant x
    for (let x = -1; x<1.0; x+=dx){
        grid_vertices.push(x);
        grid_vertices.push(-1.0);
        grid_vertices.push(x);
        grid_vertices.push(1.0);
    }

    let lines_buffer = gl.createBuffer();
    gl.enableVertexAttribArray(lines_buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid_vertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);

    const color_uniform_location = gl.getUniformLocation(program, "u_color");
    const kernel_uniform_location = gl.getUniformLocation(program, "u_kernel[0]");
    const board_size_uniform_location = gl.getUniformLocation(program, "u_board_size");

    gl.uniform1fv(kernel_uniform_location, kernel);
    gl.uniform2f(board_size_uniform_location, gol_width, gol_height);

    gl.useProgram(lines_program);
    const lines_color_uniform_location = gl.getUniformLocation(lines_program, "u_color");

    // draw tiles
    //for (let y = -1.0; y<1.0; y+= dy){
        //for (let x = -1.0; x<1.0; x+=dx){
        //}
    //}

    let running = false;

    const pause_button = document.getElementById("gameOfLifePause");
    pause_button.addEventListener("click", function(){
        running = !running;
        if (running){
            pause_button.innerHTML = "Stop";
        }
        else {
            pause_button.innerHTML = "Run";
        }
    });

    const reset_button = document.getElementById("gameOfLifeReset");
    reset_button.addEventListener("click", function(){
        // TODO reset framebuffers and textures to initial state
        running = false;
    });

    function render(){
        // background square
        gl.useProgram(program);
        gl.uniform4f(color_uniform_location, 0.95, 0.95, 0.95, 1.0);
        gl.bindBuffer(gl.ARRAY_BUFFER, pos_buffer);
        gl.enableVertexAttribArray(pos_buffer);
        gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // alternate which framebuffer rendered to

        // grid
        if(!running){
            gl.useProgram(lines_program);
            gl.uniform4f(lines_color_uniform_location, .3, 0.0, 0.3, 1.0);
            gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
            gl.enableVertexAttribArray(lines_buffer);
            gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.LINES, 0, 2 * gol_height + 2 * gol_width);
        }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
})();
