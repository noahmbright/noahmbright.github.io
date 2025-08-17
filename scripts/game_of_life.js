(function() {
    const webgl_canvas = document.querySelector("#gameOfLifeCanvas");
    const gl = get_webgl_context(webgl_canvas, "webgl");
    const bytes_per_float = Float32Array.BYTES_PER_ELEMENT;

    // game of life
    let generation = 0;
    const pixels_per_cell = 8;
    const gol_height = Math.floor(webgl_canvas.height/pixels_per_cell);
    const gol_width = Math.floor(webgl_canvas.width/pixels_per_cell);
    const num_cells = gol_height * gol_width;
    const dx = 2.0/gol_width;
    const dy = 2.0/gol_height;
    let gol_board = new Array(4 * num_cells).fill(0);
    gl.viewport(0, 0, webgl_canvas.width, webgl_canvas.height);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    let prev_time = Date.now();
    let elapsed_time = 0;
    const threshold = 1000/10; // 10 updates per second
    let iteration = 1;
    let running = false;

    function set_board(index, value){
        gol_board[4*index] = value;
    }

    // buffer the board to the currently bound TEXTURE_2D
    function buffer_board_to_texture(){
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            gol_width, gol_height, 0, gl.RGBA,
            gl.UNSIGNED_BYTE, new Uint8Array(gol_board));
    };

    function glider(x, y){
        set_board(y * gol_width + x + 0, 255);
        set_board((y-1) * gol_width + x + 1, 255);
        set_board((y-1) * gol_width + x + 2, 255);
        set_board((y-2) * gol_width + x + 0, 255);
        set_board((y-2) * gol_width + x + 1, 255);
    }

    const kernel = [
        1, 1, 1,
        1, 9, 1,
        1, 1, 1
    ];

    const main_fbo = gl.createFramebuffer();
    const main_texture = create_texture(gl);
    gl.bindTexture(gl.TEXTURE_2D, main_texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, main_fbo);
    buffer_board_to_texture();

    framebuffers = [];
    textures = [];
    for (let i = 0; i<2; i++){
        textures.push(create_texture(gl));
        framebuffers.push(gl.createFramebuffer());
        gl.bindTexture(gl.TEXTURE_2D, textures[i]);
        buffer_board_to_texture();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, textures[i], 0);
    }

    const gol_vertex_shader_source = `
        attribute vec2 a_pos;
        attribute vec2 a_tex_coord;
        varying vec2 v_tex_coord;

        void main(){
            gl_Position = vec4(a_pos, 0, 1.0);
            v_tex_coord = a_tex_coord;
        }
    `

    // https://iquilezles.org/articles/gameoflife/   `
    // Inigo gets credit for putting 9 in the middle of the kernel
    const gol_fragment_shader_source = `
        precision mediump float;
        uniform float u_kernel[9];
        uniform vec2 u_board_size;
        uniform sampler2D u_board;
        varying vec2 v_tex_coord;

        void main(){
            vec4 alive_color = vec4(1.0, 0.0, 0.0, 1.0);
            vec4 dead_color = vec4(0.0, 0.0, 1.0, 1.0);
            vec2 one_pixel = vec2(1.0, 1.0) / u_board_size;

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

            gl_FragColor =  (sum == 3 || sum == 11 || sum == 12) ? alive_color : dead_color;
        }
    `

    const quads_vertex_shader_source = `
        attribute vec2 a_pos;
        attribute vec2 a_tex_coords;
        varying vec2 v_tex_coords;
        
        void main(){
            gl_Position = vec4(a_pos, 0.0, 1.0);
            v_tex_coords = a_tex_coords;
        }
    `;

    const quads_fragment_shader_source = `
        precision mediump float;
        uniform sampler2D u_board;
        varying vec2 v_tex_coords;

        void main(){
            vec4 alive_color = vec4(0.0, 0.0, 1.0, 1.0);
            vec4 dead_color = vec4(1.0, 0.0, 0.0, 1.0);

            int current = int(texture2D(u_board, v_tex_coords));
            if (current == 1){
                gl_FragColor = alive_color;
                gl_FragColor = vec4(vec3(float(current)/8.0), 1.0);
            }
            else{
                gl_FragColor = dead_color;
                gl_FragColor = vec4(vec3(float(current)/8.0), 1.0);
            }
        }
    `;
    
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
    
    let gol_program = create_and_link_shaders(gl, gol_vertex_shader_source, gol_fragment_shader_source);
    let lines_program = create_and_link_shaders(gl, lines_vertex_shader_source, lines_fragment_shader_source);
    let quads_program = create_and_link_shaders(gl, quads_vertex_shader_source, quads_fragment_shader_source);

    // draw tiles
    // BL, TL, TR, BR
    let quad_vertices = [];
    for (let y = -1.0; y < 1.0; y += dy){
        for (let x = -1.0; x < 1.0; x += dx){
            quad_vertices.push(x);
            quad_vertices.push(y);
            quad_vertices.push((x + 1.0)/2);
            quad_vertices.push((y + 1.0)/2);

            quad_vertices.push(x);
            quad_vertices.push(y + dy);
            quad_vertices.push((x + 1.0)/2);
            quad_vertices.push((y + dy + 1.0)/2);

            quad_vertices.push(x + dx);
            quad_vertices.push(y + dy);
            quad_vertices.push((x + dx + 1.0)/2);
            quad_vertices.push((y + dy + 1.0)/2);

            quad_vertices.push(x + dx);
            quad_vertices.push(y);
            quad_vertices.push((x + dx + 1.0)/2);
            quad_vertices.push((y + 1.0)/2);
        }
    }

    let quad_indices = [];
    for (let i = 0; i < num_cells; i++){
        quad_indices.push(4*i + 0);
        quad_indices.push(4*i + 1);
        quad_indices.push(4*i + 2);
        quad_indices.push(4*i + 0);
        quad_indices.push(4*i + 2);
        quad_indices.push(4*i + 3);
    }

    // draw gridlines
    let gridline_vertices = [];
    // horizontal lines of constant y
    for (let y = -1; y<1.0; y+=dy){
        gridline_vertices.push(-1.0);
        gridline_vertices.push(y);
        gridline_vertices.push(1.0);
        gridline_vertices.push(y);
    }
    // vertical lines of constant x
    for (let x = -1; x<1.0; x+=dx){
        gridline_vertices.push(x);
        gridline_vertices.push(-1.0);
        gridline_vertices.push(x);
        gridline_vertices.push(1.0);
    }

    let quads_buffer = gl.createBuffer();
    const quads_indices_buffer = gl.createBuffer();

    // gol program
    gl.useProgram(gol_program);
    let position_attribute_location = gl.getAttribLocation(gol_program, "a_pos");
    let texture_coords_attribute_location = gl.getAttribLocation(gol_program, "a_tex_coord");

    const kernel_uniform_location = gl.getUniformLocation(gol_program, "u_kernel[0]");
    const board_size_uniform_location = gl.getUniformLocation(gol_program, "u_board_size");
    const board_uniform_location = gl.getUniformLocation(gol_program, "u_board");

    gl.uniform1fv(kernel_uniform_location, kernel);
    gl.uniform2f(board_size_uniform_location, gol_width, gol_height);

    gl.bindBuffer(gl.ARRAY_BUFFER, quads_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad_vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quads_indices_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(quad_indices), gl.STATIC_DRAW);
    
    // quads program
    const quads_pos_location = gl.getAttribLocation(quads_program, "a_pos");
    const quads_tex_coords_location = gl.getAttribLocation(quads_program, "a_tex_coords");
    const quads_board_location = gl.getUniformLocation(quads_program, "u_board");

    // lines program uniforms
    gl.useProgram(lines_program);
    let lines_buffer = gl.createBuffer();
    const lines_color_uniform_location = gl.getUniformLocation(lines_program, "u_color");

    gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridline_vertices), gl.STATIC_DRAW);

    function draw_lines(){
        gl.useProgram(lines_program);
        gl.uniform4f(lines_color_uniform_location, .3, 0.0, 0.3, 1.0);
        gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
        gl.enableVertexAttribArray(position_attribute_location);
        gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, 2 * (gol_height + gol_width));
    }

    gl.clearColor(0.1, 0.5, 0.2, 1.0);
    const pause_button = document.getElementById("gameOfLifePause");
    function pause(){
        pause_button.innerHTML = "Run";
        elapsed_time = 0;
        prev_time = Date.now();
        running = false;
    }
    pause_button.addEventListener("click", function(){
        if (running){
            pause();
        }
        else {
            running = true;
            pause_button.innerHTML = "Stop";
            // TODO pull data from texture/framebuffer into gol board
            
        }
    });

    const reset_button = document.getElementById("gameOfLifeReset");
    reset_button.addEventListener("click", function(){
        gol_board = gol_board.fill(0);
        buffer_board_to_texture();
        init_board();
    });

    let randomization_threshold = 0.5;
    const randomize_probability_input = document.getElementById("gameOfLifeRandomProb");
    randomize_probability_input.addEventListener("keydown", function(event){
        if (event.key === "Enter"){
            randomization_threshold = event.target.value || 0.5;
            randomize_probability_input.value = randomization_threshold;
        }
    });

    const randomize_button = document.getElementById("gameOfLifeRandomize");
    randomize_button.addEventListener("click", function(){
        running = false;
        for (let i = 0; i < num_cells; i++){
            const x = Math.random();
            if (x < randomization_threshold){
                set_board(i, 255);
            }
            else {
                set_board(i, 0);
            }
        }
        pause();
        buffer_board_to_texture();
    });

    webgl_canvas.addEventListener('click', function(e) {
        if (!running){
            const rect = webgl_canvas.getBoundingClientRect();
            const mouse_x = e.clientX - rect.left;
            const mouse_y = rect.height - e.clientY + rect.top - 1;

            const pixel_x = Math.floor(mouse_x / pixels_per_cell);
            const pixel_y = Math.floor(mouse_y / pixels_per_cell);

            const index = pixel_y * gol_width + pixel_x
            const value = 255;
            set_board(index, gol_board[4*index] === value ? 0 : value);
            buffer_board_to_texture();
        }
    }, false);

    // on init, bind framebuffers[0]
    // render the board into the texture attached to framebuffers[0], sampling textures[1]
    // next, render to framebuffers[1], sampling textures[0]
    function init_board(){
        running = false;
        time_elapsed = 0;
        iteration = 1;
        glider(5, gol_height - 5);
        pause_button.innerHTML = "Run";

        // this is what framebuffer we're going to render to
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[0]);
        // this is what texture we sample
        gl.bindTexture(gl.TEXTURE_2D, textures[1]);
        buffer_board_to_texture();
    }

    init_board();

    function render(){
        current_time = Date.now();
        dt = current_time - prev_time;
        prev_time = current_time;

        gl.bindBuffer(gl.ARRAY_BUFFER, quads_buffer);
        gl.enableVertexAttribArray(position_attribute_location);
        gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 4*bytes_per_float, 0);
        gl.enableVertexAttribArray(texture_coords_attribute_location);
        gl.vertexAttribPointer(texture_coords_attribute_location, 2, gl.FLOAT, false, 4*bytes_per_float, 2*bytes_per_float);

        gl.clear(gl.COLOR_BUFFER_BIT);

        // render to texture
        // on init, framebuffers[0] and textures[1] are bound
        // the first iteration needs to 
        // render to framebuffers[0], which has textures[0] bound to it
        // next, render to framebuffers[1], sampling textures[0]
        if (running){
            elapsed_time += dt;

            if (elapsed_time > threshold){
                elapsed_time -= threshold;

                gl.viewport(0, 0, gol_width, gol_height);
                gl.useProgram(gol_program);
                gl.uniform1i(board_uniform_location, 0);
                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[iteration % 2]);

                gl.drawElements(gl.TRIANGLES, 6 * num_cells, gl.UNSIGNED_SHORT, 0);
                gl.bindTexture(gl.TEXTURE_2D, textures[iteration % 2]);
                iteration++;
            }
        }

        // render to canvas
        gl.viewport(0, 0, webgl_canvas.width, webgl_canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(quads_program);
        gl.uniform1i(quads_board_location, 0);

        gl.drawElements(gl.TRIANGLES, 6 * num_cells, gl.UNSIGNED_SHORT, 0);

        // grid
        if(!running){
            draw_lines();
        }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
})();
