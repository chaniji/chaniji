#version 300 es
// CRT effect: small screen curve + scanlines + light old TV colors. Static (no time uniform).
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

const float CURVE = 0.02;             // 0.0 = flat screen
const float SCANLINE_PERIOD = 4.0;    // pixels per scanline
const float SCANLINE_STRENGTH = 0.25; // 0.0 = none
const float SATURATION = 1.09;        // 1.0 = no change
const float BLACK_LIFT = 0.015;       // 0.0 = pure black
const vec3 WARM_TINT = vec3(1.025, 1.0, 0.96); // 1,1,1 = no tint

void main() {
    // Curve the picture like a glass tube.
    vec2 c = v_texcoord - 0.5;
    vec2 uv = 0.5 + c * (1.0 + CURVE * dot(c, c) * 2.0);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 color = texture(tex, uv);

    // Old TV colors: richer, warmer, soft blacks.
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(luma), color.rgb, SATURATION);
    color.rgb *= WARM_TINT;
    color.rgb = color.rgb * (1.0 - BLACK_LIFT) + BLACK_LIFT;

    float line = 0.5 + 0.5 * cos(gl_FragCoord.y * 6.2831853 / SCANLINE_PERIOD);
    color.rgb *= 1.0 - SCANLINE_STRENGTH * line;

    // Lift so the picture does not look dull.
    color.rgb *= 1.14;

    fragColor = color;
}
