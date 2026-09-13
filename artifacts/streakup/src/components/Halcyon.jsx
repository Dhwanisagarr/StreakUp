import { useEffect, useRef } from "react";

const PRESETS = {
  "Midnight Aurora": ["#05060A", "#0EA5E9", "#6366F1", "#22D3EE"],
  "Acid Lime": ["#060807", "#0C1A08", "#74A30C", "#CCFF00"],
  "Neon Magenta": ["#0A0510", "#7C3AED", "#DB2777", "#06B6D4"],
  "Plasma Violet": ["#0A0118", "#4C1D95", "#9333EA", "#E879F9"],
  "Soft Bloom": ["#FDE7F3", "#C7D2FE", "#A7F3D0", "#FBCFE8"],
  "Morning Haze": ["#FFF7ED", "#FEF3C7", "#DBEAFE", "#E9D5FF"],
  "Mint Cloud": ["#ECFEFF", "#CFFAFE", "#D1FAE5", "#BAE6FD"],
  "Sunset Drive": ["#1A0B2E", "#F97316", "#DB2777", "#FACC15"],
  Vaporwave: ["#2A0A4A", "#FF2E97", "#00E5FF", "#B14EFF"],
  "Solar Flare": ["#160A04", "#FF5400", "#FFBD00", "#FF006E"],
  Ember: ["#FACC15", "#F97316", "#EF4444", "#D946EF"],
  "Orange Yellow": ["#180A04", "#E86F35", "#F59E0B", "#FACC15", "#FEF3C7"],
  "Pastel Sage": ["#0f261c", "#1c4d3b", "#3e7e65", "#7cb89a", "#d4e7db"],
  Arctic: ["#06101F", "#1E3A8A", "#3B82F6", "#BAE6FD"],
};

function parseColor(input) {
  if (!input) return [0, 0, 0];
  const s = input.trim();
  if (s[0] === "#") {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const rgbM = s.match(/rgba?\(([^)]+)\)/);
  if (rgbM) {
    const p = rgbM[1].split(",").map((x) => parseFloat(x));
    return [p[0] / 255, p[1] / 255, p[2] / 255];
  }
  const hslM = s.match(/hsla?\(([^)]+)\)/);
  if (hslM) {
    const p = hslM[1].split(",").map((x) => parseFloat(x));
    const h = p[0] / 360;
    const sl = p[1] / 100;
    const l = p[2] / 100;
    const hue2rgb = (pp, qq, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return pp + (qq - pp) * 6 * t;
      if (t < 1 / 2) return qq;
      if (t < 2 / 3) return pp + (qq - pp) * (2 / 3 - t) * 6;
      return pp;
    };
    if (sl === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + sl) : l + sl - l * sl;
    const pp = 2 * l - q;
    return [hue2rgb(pp, q, h + 1 / 3), hue2rgb(pp, q, h), hue2rgb(pp, q, h - 1 / 3)];
  }
  return [0, 0, 0];
}

const VERT = `attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform int u_colorCount;
uniform float u_speed;
uniform float u_scale;
uniform float u_warp;
uniform float u_grain;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
vec3 palette(float t){
  t = clamp(t, 0.0, 1.0);
  float seg = t * float(u_colorCount - 1);
  vec3 col = u_c0;
  if (u_colorCount > 1) {
    if (seg <= 1.0) col = mix(u_c0, u_c1, smoothstep(0.0, 1.0, seg));
    else if (seg <= 2.0) col = mix(u_c1, u_c2, smoothstep(0.0, 1.0, seg - 1.0));
    else if (seg <= 3.0) col = mix(u_c2, u_c3, smoothstep(0.0, 1.0, seg - 2.0));
    else col = mix(u_c3, u_c4, smoothstep(0.0, 1.0, seg - 3.0));
  }
  return col;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv; p.x *= aspect; p *= u_scale;
  float t = u_time * u_speed * 0.1;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  vec2 r = vec2(fbm(p + u_warp * q + vec2(1.7, 9.2) + 0.15 * t), fbm(p + u_warp * q + vec2(8.3, 2.8) - 0.12 * t));
  float f = fbm(p + u_warp * r);
  float mixv = clamp(f * 1.5, 0.0, 1.0);
  vec3 col = palette(mixv);
  col *= 0.74 + 0.40 * r.x;
  col = (col - 0.5) * 1.08 + 0.5;
  float g = (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * u_grain;
  col += g;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("Halcyon: shader compile failed —", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function Halcyon({
  preset = "Orange Yellow",
  color1 = "#180A04",
  color2 = "#E86F35",
  color3 = "#F59E0B",
  color4 = "#FACC15",
  color5 = "#FEF3C7",
  colorCount = 5,
  speed = 1.2,
  scale = 1.6,
  warp = 2.4,
  grain = 0.035,
  borderRadius = 0,
  style,
  className,
}) {
  const activeColors =
    preset !== "Custom" && PRESETS[preset]
      ? PRESETS[preset]
      : [color1, color2, color3, color4, color5].slice(0, Math.max(2, Math.min(5, colorCount)));

  const fallbackGradient = `linear-gradient(135deg, ${activeColors.join(", ")})`;
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      console.warn("Halcyon: WebGL unavailable — falling back to CSS gradient.");
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Halcyon: program link failed —", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n) => gl.getUniformLocation(program, n);
    const uTime = u("u_time");
    const uRes = u("u_resolution");

    const cols = [color1, color2, color3, color4, color5];
    const count = Math.max(2, Math.min(5, activeColors.length));
    const srcCols = preset !== "Custom" && PRESETS[preset] ? PRESETS[preset] : cols;
    const last = parseColor(srcCols[count - 1]);

    ["u_c0", "u_c1", "u_c2", "u_c3", "u_c4"].forEach((name, i) => {
      const c = i < count ? parseColor(srcCols[i]) : last;
      gl.uniform3f(u(name), c[0], c[1], c[2]);
    });

    gl.uniform1i(u("u_colorCount"), count);
    gl.uniform1f(u("u_speed"), speed);
    gl.uniform1f(u("u_scale"), scale);
    gl.uniform1f(u("u_warp"), warp);
    gl.uniform1f(u("u_grain"), grain);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const draw = (timeMs) => {
      gl.uniform1f(uTime, timeMs * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let running = false;
    const loop = (t) => {
      if (!running) return;
      draw(t);
      rafRef.current = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      rafRef.current = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };

    let io = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) start();
            else stop();
          }
        },
        { rootMargin: "200px" }
      );
      io.observe(canvas);
    } else {
      start();
    }

    return () => {
      stop();
      io?.disconnect();
      ro?.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [preset, color1, color2, color3, color4, color5, colorCount, speed, scale, warp, grain]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius,
        background: fallbackGradient,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        aria-hidden="true"
      />
    </div>
  );
}

export default Halcyon;
