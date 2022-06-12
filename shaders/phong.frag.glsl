#version 300 es
precision mediump float;

// Data Structure Definitions
#define MAX_NUM_LIGHTS 10

struct PointLight {
    vec3 position;
    vec3 Is;
    vec3 Id;
    float k;
};

struct DirectionalLight {
    vec3 direction;
    vec3 Is;
    vec3 Id;
};

// Lighting Parameters
uniform vec3 Ia;
uniform int num_point_lights;
uniform PointLight point_lights[MAX_NUM_LIGHTS];
uniform int num_directional_lights;
uniform DirectionalLight directional_lights[MAX_NUM_LIGHTS];

// Material Parameters
uniform vec3 ka;
uniform vec3 kd;
uniform vec3 ks;
uniform float alpha;

// Camera Parameters
uniform vec3 u_camera_position;

// Passed in from the vertex shader
in vec3 v_position;
in vec3 v_normal;
in vec3 v_color; 
// Final color
out vec4 out_color;

void main() {
    
    vec3 position = v_position;
    vec3 N = v_normal;
    vec3 V = normalize(u_camera_position - position);

    vec3 I = ka * Ia;
    for (int i = 0; i < num_point_lights; i++) {
        vec3 L = normalize(point_lights[i].position - position);
        vec3 R = normalize(reflect(-L, N));
        float d = distance(point_lights[i].position, position);
        float attenuation = 1.0 / (1.0 + point_lights[i].k*d*d);
        I += kd * max(dot(L, N), 0.0) * point_lights[i].Id * attenuation;
        I += ks * pow(max(dot(R, V), 0.0), alpha) * point_lights[i].Is * attenuation;
    }
    for (int i = 0; i < num_directional_lights; i++) {
        vec3 L = -normalize(directional_lights[i].direction);
        vec3 R = normalize(reflect(-L, N));
        I += kd * max(dot(L, N), 0.0) * directional_lights[i].Id;
        I += ks * pow(max(dot(R, V), 0.0), alpha) * point_lights[i].Is;
    }


    out_color = vec4(I*v_color, 1.0);
}
