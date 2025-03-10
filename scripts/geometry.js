// TODO metal gear solid style vision cone
// get active element with focused_element = document.activeElement;
(function(){
    gl = get_webgl_context("#geometryCanvas", "webgl2");
    let aspect_ratio = gl.canvas.clientWidth / gl.canvas.clientHeight; 

    let focused_on_sphere = true;
    let camera_position = [0, 0, 1];
    let camera_focus = [0, 0, 0];
    let camera_up = [0, 1, 0];

    let sphere_position = [0, 0, 0]
    let sphere_scaling = [1, 1, 1];
    let light_orbit_radius = 2.0

    let fov = 45;
    let near = 0.1;
    let far = 100;

    let background_color = [0.1, 0.1, 1];
    let ambient_strength = 0.5;
    let specular_strength = 0.1;
    let shininess = 32.0;

    const vertex_source = `#version 300 es
        in vec3 a_position;
        in vec3 a_normal;

        out vec3 normal;
        out vec3 frag_position;

        uniform mat4 u_model;
        uniform mat4 u_rotation;
        uniform mat4 u_view;
        uniform mat4 u_projection;

        void main(){
            mat4 model = u_model*u_rotation;
            frag_position = vec3(model*vec4(a_position, 1.0));
            gl_Position = u_projection * u_view * vec4(frag_position, 1.0);
            normal = mat3(transpose(inverse(model))) * a_normal;
        }
    `

    const fragment_source = `#version 300 es
        precision mediump float;
        out vec4 FragColor;
        in vec3 normal;
        in vec3 frag_position;

        uniform vec3 u_light_position;

        uniform vec3 u_ambient_color;
        uniform float u_ambient_strength;
        uniform float u_specular_strength;
        uniform float u_shininess;
        uniform vec3 u_camera_position;

        void main(){
            float dot_product = max(dot(normal, normalize(u_light_position - frag_position)), 0.0);
            vec3 diffuse = vec3(dot_product);

            vec3 ambient = u_ambient_color*u_ambient_strength;

            vec3 view_dir = normalize(u_camera_position - frag_position);
            vec3 reflect_dir = normalize(reflect(-view_dir, normal));
            vec3 halfway = normalize(view_dir + reflect_dir);
            float specular = pow(max(dot(view_dir, reflect_dir), 0.0), u_shininess);
            specular = pow(max(dot(normal, halfway), 0.00), u_shininess);
            vec3 specular_color = u_specular_strength * specular*vec3(1.0);

            FragColor = vec4(vec3(1.0)*(ambient + diffuse + specular_color), 1.0);
        }
    `

    const sphere_program = create_and_link_shaders(gl, vertex_source, fragment_source);
    gl.useProgram(sphere_program);

    const u_model_location = gl.getUniformLocation(sphere_program, "u_model");
    const u_rotation_location = gl.getUniformLocation(sphere_program, "u_rotation");
    const u_view_location = gl.getUniformLocation(sphere_program, "u_view");
    const u_projection_location = gl.getUniformLocation(sphere_program, "u_projection");
    const u_light_position_location = gl.getUniformLocation(sphere_program, "u_light_position");
    const u_ambient_color_location = gl.getUniformLocation(sphere_program, "u_ambient_color");
    const u_ambient_strength_location = gl.getUniformLocation(sphere_program, "u_ambient_strength");
    const u_specular_strength_location = gl.getUniformLocation(sphere_program, "u_specular_strength");
    const u_camera_position_location = gl.getUniformLocation(sphere_program, "u_camera_position");
    const u_shininess_location = gl.getUniformLocation(sphere_program, "u_shininess");

    function generate_model_matrix(scale, translation){
        let model = scaling_matrix4d(scale[0], scale[1], scale[2]);
        model = multiply_matrix4d(
            translation_matrix4d(translation[0], translation[1], translation[2]), model);
        return model;
    }
    let model = generate_model_matrix(sphere_scaling, sphere_position);
    let rotation_matrix = identity_matrix4d();

    const sphere_info = generate_sphere_info(0.4, 20, 15, gl, sphere_program);

    let view = look_at_matrix(camera_position, camera_focus, camera_up);
    let projection = perspective_projection(45, aspect_ratio, 0.1, 100);

    gl.uniformMatrix4fv(u_model_location, false, model);
    gl.uniformMatrix4fv(u_view_location, false, view);
    gl.uniformMatrix4fv(u_projection_location, false, projection);
    gl.uniformMatrix4fv(u_rotation_location, false, rotation_matrix);
    gl.uniform3fv(u_ambient_color_location, background_color);
    gl.uniform3fv(u_camera_position_location, camera_position);
    gl.uniform1f(u_ambient_strength_location, ambient_strength);
    gl.uniform1f(u_ambient_strength_location, ambient_strength);
    gl.uniform1f(u_specular_strength_location, specular_strength);
    gl.uniform1f(u_shininess_location, shininess);

    const light_vertex= `#version 300 es
        in vec3 a_position;
        in vec3 a_normal;
        out vec3 normal;

        uniform mat4 u_model;
        uniform mat4 u_view;
        uniform mat4 u_projection;

        void main(){
            gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
            normal = a_normal;
        }
    `
    const light_fragment = `#version 300 es
        precision highp float;

        in vec3 normal;
        out vec4 frag_color;
        void main(){
            frag_color = vec4(vec3(1.0), 1.0);
        }
    `
    const light_program = create_and_link_shaders(gl, light_vertex, light_fragment);
    gl.useProgram(light_program);
    const light_u_model_location = gl.getUniformLocation(light_program, "u_model");
    const light_u_view_location = gl.getUniformLocation(light_program, "u_view");
    const light_u_projection_location = gl.getUniformLocation(light_program, "u_projection");
    const light_sphere_info = generate_sphere_info(0.1, 10, 8, gl, light_program);
    gl.uniformMatrix4fv(light_u_view_location, false, view);
    gl.uniformMatrix4fv(light_u_projection_location, false, projection);

    const origin_vertex = `#version 300 es
        in vec3 a_position;
        in vec3 a_normal;
        out vec3 normal;

        uniform mat4 u_model;
        uniform mat4 u_view;
        uniform mat4 u_projection;

        void main(){
            gl_Position = u_projection*u_view*u_model*vec4(a_position, 1.0);
        }
    `

    const origin_fragment = `#version 300 es
        precision highp float;
        in vec3 normal;
        out vec4 frag_color;
        void main(){
            frag_color = vec4(vec3(0.8), 1.0);
        }
    `

    const origin_program = create_and_link_shaders(gl, origin_vertex, origin_fragment);
    gl.useProgram(origin_program);
    const origin_u_model_location = gl.getUniformLocation(origin_program, "u_model");
    const origin_u_view_location = gl.getUniformLocation(origin_program, "u_view");
    const origin_u_projection_location = gl.getUniformLocation(origin_program, "u_projection");
    const origin_sphere_info = generate_sphere_info(0.01, 10, 8, gl, origin_program);
    gl.uniformMatrix4fv(origin_u_view_location, false, view);
    gl.uniformMatrix4fv(origin_u_projection_location, false, projection);
    gl.uniformMatrix4fv(origin_u_model_location, false, identity_matrix4d());

    //gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(background_color[0], background_color[1], background_color[2], 1.0);

    const ball_x_slider = document.getElementById("ballXSlider");
    const ball_x_value = document.getElementById("ballXValue");
    ball_x_slider.addEventListener("input", () => {
        gl.useProgram(sphere_program);
        ball_x_value.textContent = ball_x_slider.value;
        sphere_position[0] = Number(ball_x_slider.value);
        model = generate_model_matrix(sphere_scaling, sphere_position);
        gl.uniformMatrix4fv(u_model_location, false, model);
    });

    const ball_y_slider = document.getElementById("ballYSlider");
    const ball_y_value = document.getElementById("ballYValue");
    ball_y_slider.addEventListener("input", () => {
        gl.useProgram(sphere_program);
        ball_y_value.textContent = ball_y_slider.value;
        sphere_position[1] = Number(ball_y_slider.value);
        model = generate_model_matrix(sphere_scaling, sphere_position);
        gl.uniformMatrix4fv(u_model_location, false, model);
    });

    const ball_z_slider = document.getElementById("ballZSlider");
    const ball_z_value = document.getElementById("ballZValue");
    ball_z_slider.addEventListener("input", () => {
        gl.useProgram(sphere_program);
        ball_z_value.textContent = ball_z_slider.value;
        sphere_position[2] = Number(ball_z_slider.value);
        model = generate_model_matrix(sphere_scaling, sphere_position);
        gl.uniformMatrix4fv(u_model_location, false, model);
    });

    const ball_x_scale_slider = document.getElementById("ballXScaleSlider");
    const ball_x_scale_value = document.getElementById("ballXScaleValue");
    ball_x_scale_slider.addEventListener("input", () => {
        gl.useProgram(sphere_program);
        ball_x_scale_value.textContent = ball_x_scale_slider.value;
        sphere_scaling[0] = Number(ball_x_scale_slider.value);
        model = generate_model_matrix(sphere_scaling, sphere_position);
        gl.uniformMatrix4fv(u_model_location, false, model);
    });

    const ball_y_scale_slider = document.getElementById("ballYScaleSlider");
    const ball_y_scale_value = document.getElementById("ballYScaleValue");
    ball_y_scale_slider.addEventListener("input", () => {
        gl.useProgram(sphere_program);
        ball_y_scale_value.textContent = ball_y_scale_slider.value;
        sphere_scaling[1] = Number(ball_y_scale_slider.value);
        model = generate_model_matrix(sphere_scaling, sphere_position);
        gl.uniformMatrix4fv(u_model_location, false, model);
    });

    const ball_z_scale_slider = document.getElementById("ballZScaleSlider");
    const ball_z_scale_value = document.getElementById("ballZScaleValue");
    ball_z_scale_slider.addEventListener("input", () => {
        gl.useProgram(sphere_program);
        ball_z_scale_value.textContent = ball_z_scale_slider.value;
        sphere_scaling[2] = Number(ball_z_scale_slider.value);
        model = generate_model_matrix(sphere_scaling, sphere_position);
        gl.uniformMatrix4fv(u_model_location, false, model);
    });

    function update_projection_uniform(){
        gl.useProgram(sphere_program);
        gl.uniformMatrix4fv(u_projection_location, false, projection);
        gl.useProgram(light_program);
        gl.uniformMatrix4fv(light_u_projection_location, false, projection);
        gl.useProgram(origin_program);
        gl.uniformMatrix4fv(origin_u_projection_location, false, projection);
    }

    function update_view_uniform(){
        gl.useProgram(sphere_program);
        gl.uniformMatrix4fv(u_view_location, false, view);
        gl.uniform3fv(u_camera_position_location, camera_position);
        gl.useProgram(light_program);
        gl.uniformMatrix4fv(light_u_view_location, false, view);
        gl.useProgram(origin_program);
        gl.uniformMatrix4fv(origin_u_view_location, false, view);
    }

    function update_camera_up(){
        const dir = normalized_vector(camera_position);
        const xy = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1]);
        const sign = dir[2] > 0 ? 1 : -1;
        if (Math.abs(dir[1]) < 1e-2){
            camera_up = [0, 1, 0];
            return;
        }

        camera_up = [
            -dir[0]*dir[2]/xy * sign,
            -dir[1]*dir[2]/xy * sign,
            xy 
        ];
    }

    const camera_x_slider = document.getElementById("cameraXSlider");
    const camera_x_value = document.getElementById("cameraXValue");
    camera_x_slider.addEventListener("input", () => {
        camera_x_value.textContent = camera_x_slider.value;
        camera_position[0] = Number(camera_x_slider.value);
        update_camera_up();
        view = look_at_matrix(camera_position, camera_focus, camera_up); 
        update_view_uniform();
    });

    const camera_y_slider = document.getElementById("cameraYSlider");
    const camera_y_value = document.getElementById("cameraYValue");
    camera_y_slider.addEventListener("input", () => {
        camera_y_value.textContent = camera_y_slider.value;
        camera_position[1] = Number(camera_y_slider.value);
        update_camera_up();
        view = look_at_matrix(camera_position, camera_focus, camera_up); 
        update_view_uniform();
    });

    const camera_z_slider = document.getElementById("cameraZSlider");
    const camera_z_value = document.getElementById("cameraZValue");
    camera_z_slider.addEventListener("input", () => {
        camera_z_value.textContent = camera_z_slider.value;
        camera_position[2] = Number(camera_z_slider.value);
        update_camera_up();
        view = look_at_matrix(camera_position, camera_focus, camera_up); 
        update_view_uniform();
    });

    const camera_fov_slider = document.getElementById("cameraFovSlider");
    const camera_fov_value = document.getElementById("cameraFovValue");
    camera_fov_slider.addEventListener("input", () => {
        camera_fov_value.textContent = camera_fov_slider.value;
        fov = Number(camera_fov_slider.value);
        projection = perspective_projection(fov, aspect_ratio, near, far);
        update_projection_uniform();
    });

    const camera_near_slider = document.getElementById("cameraNearSlider");
    const camera_near_value = document.getElementById("cameraNearValue");
    camera_near_slider.addEventListener("input", () => {
        camera_near_value.textContent = camera_near_slider.value;
        near = Number(camera_near_slider.value);
        projection = perspective_projection(fov, aspect_ratio, near, far);
        update_projection_uniform();
    });

    const camera_far_slider = document.getElementById("cameraFarSlider");
    const camera_far_value = document.getElementById("cameraFarValue");
    camera_far_slider.addEventListener("input", () => {
        camera_far_value.textContent = camera_far_slider.value;
        far = camera_far_slider.value;
        projection = perspective_projection(fov, aspect_ratio, near, far);
        update_projection_uniform();
    });

    const background_x_slider = document.getElementById("backgroundXSlider");
    const background_x_value = document.getElementById("backgroundXValue");
    background_x_slider.addEventListener("input", () => {
        background_x_value.textContent = background_x_slider.value;
        background_color[0] = Number(background_x_slider.value);
        gl.clearColor(background_color[0], background_color[1], background_color[2], 1.0);
        gl.useProgram(sphere_program);
        gl.uniform3fv(u_ambient_color_location, background_color);
    });

    const background_y_slider = document.getElementById("backgroundYSlider");
    const background_y_value = document.getElementById("backgroundYValue");
    background_y_slider.addEventListener("input", () => {
        background_y_value.textContent = background_y_slider.value;
        background_color[1] = Number(background_y_slider.value);
        gl.clearColor(background_color[0], background_color[1], background_color[2], 1.0);
        gl.useProgram(sphere_program);
        gl.uniform3fv(u_ambient_color_location, background_color);
    });

    const background_z_slider = document.getElementById("backgroundZSlider");
    const background_z_value = document.getElementById("backgroundZValue");
    background_z_slider.addEventListener("input", () => {
        background_z_value.textContent = background_z_slider.value;
        background_color[2] = Number(background_z_slider.value);
        gl.clearColor(background_color[0], background_color[1], background_color[2], 1.0);
        gl.useProgram(sphere_program);
        gl.uniform3fv(u_ambient_color_location, background_color);
    })

    function render(){
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const light_position = [
            sphere_position[0] + light_orbit_radius * Math.cos(Date.now()*1e-3),
            sphere_position[1] + 0.0,
            sphere_position[2] + light_orbit_radius * Math.sin(Date.now()*1e-3)
        ];

        // sphere
        gl.useProgram(sphere_program);
        gl.uniform3fv(u_light_position_location, light_position);

        rotation_matrix = multiply_matrix4d(x_rotation_matrix4d(1e-2), rotation_matrix);
        gl.uniformMatrix4fv(u_rotation_location, false, rotation_matrix);

        draw_sphere(sphere_info);

        // light
        const model = generate_model_matrix([1,1,1], light_position);
        gl.useProgram(light_program);
        gl.uniformMatrix4fv(light_u_model_location, false, model);
        draw_sphere(light_sphere_info);
        requestAnimationFrame(render);

        // origin
        gl.useProgram(origin_program);
        draw_sphere(origin_sphere_info);
    }

    requestAnimationFrame(render);
})();


