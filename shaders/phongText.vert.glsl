#version 300 es

in vec3 a_position;
in vec3 a_color;
in vec3 a_normal;
in vec2 a_text_coord;

uniform mat4 u_m_matrix;
uniform mat4 u_v_matrix;
uniform mat4 u_p_matrix;

out highp vec2 v_text_coord;
out vec3 v_position;
out vec3 v_color;
out vec3 v_normal;

void main() {

    v_position = vec3(u_m_matrix * vec4(a_position, 1.0));
    v_color = a_color;
    v_normal = normalize(mat3(transpose(inverse(u_m_matrix))) * a_normal);
    v_text_coord = a_text_coord;
    // Multiply the position by the matrix.
    gl_Position = u_p_matrix * u_v_matrix * u_m_matrix * vec4(a_position, 1.0);
     
}