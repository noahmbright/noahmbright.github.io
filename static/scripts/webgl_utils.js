function resize_canvas_to_display_size(canvas) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

function get_webgl_context(canvas, gl_type) {
    const gl = canvas.getContext(gl_type);
    if (!gl) {
        console.log(`Couldn't get ${gl_type} context`);
    }
    return gl;
}

function create_shader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function create_program(gl, vertex_shader, fragment_shader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

function create_and_link_shaders(gl, vertex_shader_source, fragment_shader_source) {
    const vertex_shader = create_shader(gl, gl.VERTEX_SHADER, vertex_shader_source);
    const fragment_shader = create_shader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);
    const program = create_program(gl, vertex_shader, fragment_shader);
    return program;
}

function create_texture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

// https://stackoverflow.com/questions/2588875/whats-the-best-way-to-draw-a-fullscreen-quad-in-opengl-3-2
//
// why all the clipping outside the viewport doesn't hurt performance:
// https://fgiesen.wordpress.com/2011/07/05/a-trip-through-the-graphics-pipeline-2011-part-5/
//
// on the 2x2 pixel rendering thing:
// https://fgiesen.wordpress.com/2011/07/10/a-trip-through-the-graphics-pipeline-2011-part-8/
// https://stackoverflow.com/questions/52975878/what-is-in-simple-terms-texturegrad/52977548#52977548
const full_screen_triangle_vertex_shader_source = `#version 300 es
    precision mediump float;

    out vec2 tex_coords;

    void main(){

        vec2 vertices[3]=vec2[3](
            vec2(-1,-1),
            vec2(3,-1),
            vec2(-1, 3)
        );

        gl_Position = vec4(vertices[gl_VertexID],0,1);
        tex_coords = 0.5 * gl_Position.xy + vec2(0.5);
    }
`

function identity_matrix2d() {
    return [
        1, 0,
        0, 1
    ];
}

function rotation_matrix2d(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, -s,
        s, c
    ];
}

function multiply_matrix3d(left, right) {
    const a00 = left[0 * 3 + 0];
    const a01 = left[0 * 3 + 1];
    const a02 = left[0 * 3 + 2];
    const a10 = left[1 * 3 + 0];
    const a11 = left[1 * 3 + 1];
    const a12 = left[1 * 3 + 2];
    const a20 = left[2 * 3 + 0];
    const a21 = left[2 * 3 + 1];
    const a22 = left[2 * 3 + 2];

    const b00 = right[0 * 3 + 0];
    const b01 = right[0 * 3 + 1];
    const b02 = right[0 * 3 + 2];
    const b10 = right[1 * 3 + 0];
    const b11 = right[1 * 3 + 1];
    const b12 = right[1 * 3 + 2];
    const b20 = right[2 * 3 + 0];
    const b21 = right[2 * 3 + 1];
    const b22 = right[2 * 3 + 2];

    const c00 = b00 * a00 + b01 * a10 + b02 * a20;
    const c01 = b00 * a01 + b01 * a11 + b02 * a21;
    const c02 = b00 * a02 + b01 * a12 + b02 * a22;

    const c10 = b10 * a00 + b11 * a10 + b12 * a20;
    const c11 = b10 * a01 + b11 * a11 + b12 * a21;
    const c12 = b10 * a02 + b11 * a12 + b12 * a22;

    const c20 = b20 * a00 + b21 * a10 + b22 * a20;
    const c21 = b20 * a01 + b21 * a11 + b22 * a21;
    const c22 = b20 * a02 + b21 * a12 + b22 * a22;

    return [
        c00, c01, c02,
        c10, c11, c12,
        c20, c21, c22,
    ];
}

// use formula c_ij = sum_k b_ik a_kj
// the ij-th element in the matrix is 4 * i + j
function multiply_matrix4d(left, right) {
    let res = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            // compute the ij-th element of the result
            for (let k = 0; k < 4; k++) {
                res[4 * i + j] += left[4 * k + j] * right[4 * i + k];
            }
        }
    }

    return res;
}

// expect a 4x4 matrix and a 4 vector
function matrix_vector_multiply4d(m, v) {
    return [
        v[0] * m[0 * 4 + 0] + v[1] * m[0 * 4 + 1] + v[2] * m[0 * 4 + 2] + m[0 * 4 + 3],
        v[0] * m[1 * 4 + 0] + v[1] * m[1 * 4 + 1] + v[2] * m[1 * 4 + 2] + m[1 * 4 + 3],
        v[0] * m[2 * 4 + 0] + v[1] * m[2 * 4 + 1] + v[2] * m[2 * 4 + 2] + m[2 * 4 + 3],
        v[0] * m[3 * 4 + 0] + v[1] * m[3 * 4 + 1] + v[2] * m[3 * 4 + 2] + m[3 * 4 + 3],
    ]
}

function identity_matrix3d() {
    return [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    ];
}

function rotation_matrix3d(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, -s, 0,
        s, c, 0,
        0, 0, 1
    ];
}

function translation_matrix3d(dx, dy) {
    return [
        1, 0, 0,
        0, 1, 0,
        dx, dy, 1
    ];
}

function scaling_matrix3d(sx, sy) {
    return [
        sx, 0, 0,
        0, sy, 0,
        0, 0, 1
    ];
}

function identity_matrix4d() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ];
}

function translation_matrix4d(dx, dy, dz) {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        dx, dy, dz, 1
    ];
}

function scaling_matrix4d(sx, sy, sz) {
    return [
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        0, 0, 0, 1
    ];
}

function z_rotation_matrix4d(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, -s, 0, 0,
        s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ];
}

function y_rotation_matrix4d(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
    ];
}

function x_rotation_matrix4d(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        1, 0, 0, 0,
        0, c, -s, 0,
        0, s, c, 0,
        0, 0, 0, 1,
    ];
}

function log_matrix4d(m) {
    console.log(`${m[0]}, ${m[1]}, ${m[2]}, ${m[3]}
${m[4]}, ${m[5]}, ${m[6]}, ${m[7]}
${m[8]}, ${m[9]}, ${m[10]}, ${m[11]}
${m[12]}, ${m[13]}, ${m[14]}, ${m[15]}`);
}

// VECTORS
function vector_norm2(v) {
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

function vector_norm(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalized_vector(v) {
    const norm = vector_norm(v);
    return [v[0] / norm, v[1] / norm, v[2] / norm];
}

function add_vectors(v, u) {
    return [v[0] + u[0], v[1] + u[1], v[2] + u[2]];
}

function subtract_vectors(v, u) {
    return [v[0] - u[0], v[1] - u[1], v[2] - u[2]];
}

// to check if is array
// let boolean_is_array = Array.isArray(an_object_to_check)
// to check if is an object
// typeof(object_to_check) === "object"
function cross_product(u, v) {
    return [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
    ];
}

function dot_product(u, v) {
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

// first, translate the space back to the position of the camera
// then rotate according to the camera's orientation
// LookAt = Rotation * Translation
//
// Example with translation only
// put the camera at (0, 0, 3), and an object at (0, 0, 10)
// the camera is focused on the point (0, 0, 10)
// it's forward vector is (0, 0, 10 - 3) = (0, 0, 7)
// normalize to forward =           (0, 0, 1)
// let up =                         (0, 1, 0)
// let right = cross(forward, up) = (-1, 0, 0)
//
//            camera ->                  o
// z = 0 ----- z = 3 ----------------- z = 10
//
// What result do we expect? We want to adjust so that the camera
// is at the origin of the new coordinate system:
// camera ->                  o
// z = 0 ------------------ z = 7
// we need to subtract off the camera's position from each coordinate
// in original space
// think of this as moving the camera to the origin of the original space
//
// Example with rotation only
// Now supposed the camera has its own orthonormal basis, and the
// basis of the original space is also orthonormal
// Translation moved the camera, rotation should rotate the camera
// Rotate the camera's basis to align with the original space's
// Put the camera at (0,0)
// Make the camera's basis (0, 1), (-1, 0), written in world coords
// consider where an object at (1,0) should be in the camera's basis
//    ^cam_x
//  <<< cam_y <<<  camera --- object
//                  x = 0,   world x->
//  We want to turn the camera so it's basis looks like (1,0), (0, 1)
//  The object will move to (0, -1)
//  we need to map (1, 0) to (0, -1), a 90 degree rotation clockwise
//  the camera starts out rotated 90 degrees clockwise
//  find the rotation matrix that corresponds to the camera's initial
//  orientation, and the rotation needed here is its inverse
function look_at_matrix(position, focus, up) {
    // forward points from camera to focus, up is given, right is forward cross up
    const forward = normalized_vector(subtract_vectors(focus, position));
    const right = normalized_vector(cross_product(forward, normalized_vector(up)));
    const u = cross_product(right, forward);

    const m = [
        right[0], right[1], right[2], 0,
        u[0], u[1], u[2], 0,
        -forward[0], -forward[1], -forward[2], 0,
        -dot_product(position, right),
        -dot_product(position, u),
        dot_product(position, forward),
        1,
    ];
    return m;
}

// expect fovy in degrees
function perspective_projection(fovy, aspect_ratio, near, far) {
    const degree_to_rad = Math.acos(-1) / 180;
    const tan = Math.tan(fovy / 2 * degree_to_rad);
    const height = tan * near;
    const right = aspect_ratio * height;

    return [
        near / right, 0, 0, 0,
        0, near / height, 0, 0,
        0, 0, (near + far) / (near - far), -1,
        0, 0, (2 * near * far) / (near - far), 0
    ];
}

// geometry primitives

// quad for sanity checking
// bl, tl, tr, br
function init_sample_quad(gl, program) {
    const sample_quad_vertices = [
        -0.5, -0.5, 0.0,
        -0.5, 0.5, 0.0,
        0.5, 0.5, 0.0,
        0.5, -0.5, 0.0
    ];

    const sample_quad_indices = [
        0, 1, 2, 0, 2, 3
    ];

    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ebo = gl.createBuffer();

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sample_quad_vertices), gl.STATIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sample_quad_indices), gl.STATIC_DRAW);

    const position_attribute_location = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position_attribute_location);
    gl.vertexAttribPointer(position_attribute_location,
        3, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0
    );

    return {
        gl: gl,
        program: program,
        vao: vao,
    }
}

function draw_sample_quad(square_info) {
    const gl = square_info.gl;
    gl.useProgram(square_info.program);
    gl.bindVertexArray(square_info.vao);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

// SPHERE
// https://www.songho.ca/opengl/gl_sphere.html
// azimuth is around z axis
// zenith is angle from north/south poles
// zenith from 0 to pi, azimuth from 0 to 2pi
// projection onto z axis is cos(zenith angle)
// projection onto xy plane is sin(zenith angle)
// x = sin(zenith)cos(azimuth)
// y = sin(zenith)sin(azimuth)
// z = cos(zenith)
function generate_sphere_vertices(radius, num_azimuthal_slices, num_zenith_slices) {
    // position, normal
    let vertices = [];

    const d_zenith = Math.PI / num_zenith_slices;
    const d_azimuth = 2 * Math.PI / num_azimuthal_slices;
    const inverse_radius = 1.0 / radius;

    let zenith_angle = 0.0;
    for (let i = 0; i <= num_zenith_slices; i++) {

        let azimuthal_angle = 0.0;
        const xy_proj = radius * Math.sin(zenith_angle);
        const z = radius * Math.cos(zenith_angle);

        for (let j = 0; j <= num_azimuthal_slices; j++) {
            const x = xy_proj * Math.cos(azimuthal_angle);
            const y = xy_proj * Math.sin(azimuthal_angle);

            vertices.push(x);
            vertices.push(y);
            vertices.push(z);

            const nx = x * inverse_radius;
            const ny = y * inverse_radius;
            const nz = z * inverse_radius;

            vertices.push(nx);
            vertices.push(ny);
            vertices.push(nz);

            azimuthal_angle += d_azimuth;
        }
        zenith_angle += d_zenith;
    }

    return vertices;
}

// north and south poles are where i == 0 and i == num_zenith_slices - 1
// k1 is first index in top zenith slice
// let the verices be k1, k1 + 1, and k2, the first vertex in the next zenith slice
// the next triangle in the quad would be k1 + 1, k2 + 1, k2
// the ones where i == 0 would go k1, k2 + 1, k2
// the ones where i == num_zenith_slices - 1 go k1, k1 +1, k2
// these triangles would be clockwise
function generate_sphere_indices(num_azimuthal_slices, num_zenith_slices) {
    let indices = [];

    // i indexes how far from the poles
    for (let i = 0; i < num_zenith_slices; i++) {

        let k1 = i * (num_azimuthal_slices + 1);
        let k2 = k1 + num_azimuthal_slices + 1;

        for (let j = 0; j < num_azimuthal_slices; j++, k1++, k2++) {
            if (i != 0) {
                indices.push(k1);
                indices.push(k2);
                indices.push(k1 + 1);
            }

            if (i != (num_zenith_slices - 1)) {
                indices.push(k1 + 1);
                indices.push(k2);
                indices.push(k2 + 1);
            }
        }
    }

    return indices;
}

function generate_sphere_info(radius, num_azimuthal_slices, num_zenith_slices, gl, program) {
    const vertices = generate_sphere_vertices(radius, num_azimuthal_slices, num_zenith_slices);
    const indices = generate_sphere_indices(num_azimuthal_slices, num_zenith_slices);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    const ebo = gl.createBuffer();

    gl.useProgram(program);
    const position_attribute_location = gl.getAttribLocation(program, "a_position");
    const normal_attribute_location = gl.getAttribLocation(program, "a_normal");

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(position_attribute_location);
    gl.vertexAttribPointer(position_attribute_location,
        3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 0
    );

    gl.enableVertexAttribArray(normal_attribute_location);
    gl.vertexAttribPointer(normal_attribute_location,
        3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT
    );

    return {
        gl: gl,
        vertices: vertices,
        indices: indices,
        program: program,
        position_attribute_location: position_attribute_location,
        normal_attribute_location: normal_attribute_location,
        vao: vao,
        num_azimuthal_slices: num_azimuthal_slices,
        num_zenith_slices: num_zenith_slices,
        num_indices: indices.length,
    }
}

function draw_sphere(sphere_info) {
    sphere_info.gl.useProgram(sphere_info.program);
    sphere_info.gl.bindVertexArray(sphere_info.vao);
    sphere_info.gl.drawElements(sphere_info.gl.TRIANGLES, sphere_info.num_indices,
        sphere_info.gl.UNSIGNED_SHORT, 0);
}


const double_precision_functions = `
    // normalize
    // ensures |lo| <= 0.5ulp of |hi|
    vec2 double_normalize(vec2 dbl){
        vec2 res;
        res.x = dbl.x + dbl.y;
        res.y = dbl.y - (res.x - dbl.x);
        return res;
    }

    ////////////// addition /////////////////
    // adds two floats a and b, returns vec2 with x = high and y = rounding error
    vec2 two_sum(in float a, in float b){
        vec2 res;
        res.x = a + b;
        float v = res.x - a;
        res.y = (a - (res.x - v)) + (b - v);
        return res;
    }

    // (a.hi + a.lo) + (b.hi + b.lo)
    vec2 double_add(vec2 a, vec2 b){
        vec2 sum = two_sum(a.x, b.x);
        sum.y += a.y + b.y;
        return double_normalize(sum);
    }

    // (a.hi + a.lo) - (b.hi + b.lo)
    vec2 double_subtract(vec2 a, vec2 b){
        vec2 sum = two_sum(a.x, -b.x);
        sum.y += a.y - b.y;
        return double_normalize(sum);
    }

    ////////////// multiplication /////////////////
    // splits a float for use in exact multiplication
    vec2 split(in float a){
        vec2 res;

        const float factor = 4096.0 + 1.0; // 2^12 + 1 gets 24 bit mantissa
        float scratch[3];
        scratch[0] = factor * a;
        scratch[1] = scratch[0] - a;
        scratch[2] = scratch[0] - scratch[1];

        res.x = scratch[2];
        res.y = a - res.x;
        return res;
    }

    // exact multiplication of two floats into high and lo terms
    vec2 two_product(in float a, in float b){
        vec2 res;
        res.x = a * b;
        vec2 a_split = split(a);
        vec2 b_split = split(b);

        res.y = a_split.x * b_split.x - res.x +
                a_split.x * b_split.y +
                a_split.y * b_split.x +
                a_split.y * b_split.y;

        return res;
    }

    vec2 double_multiply(in vec2 a, in vec2 b){
        vec2 prod = two_product(a.x, b.x);
        prod.y += a.x * b.y + a.y * b.x;
        return double_normalize(prod);
    }
`
