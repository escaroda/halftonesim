import React, { useEffect, useRef, useState } from 'react';
import { Settings2, Download, Image as ImageIcon, Play, Pause, Palette, Maximize, Minimize, Activity, Link as LinkIcon, Check } from 'lucide-react';

// --- URL Sync Helpers ---
const encodeParams = (p: any) => {
  try {
    return btoa(JSON.stringify(p));
  } catch (e) { return ''; }
};

const decodeParams = (str: string) => {
  try {
    return JSON.parse(atob(str));
  } catch (e) { return null; }
};

// --- WebGL Helpers ---
function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function hex2rgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

// --- Shaders ---
const vertexShaderSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_bgColor;
uniform vec3 u_paperColor;

uniform vec3 u_lightDir1;
uniform vec3 u_lightDir2;
uniform float u_sharpness1;
uniform float u_sharpness2;

uniform float u_dotSize;
uniform float u_angle;
uniform float u_noise;
uniform float u_distortion;
uniform float u_zoom;
uniform int u_mode;

uniform float u_liquidWarp;
uniform float u_warpSpeed;
uniform float u_chromaticAberration;
uniform float u_resonance;
uniform float u_resonanceTempo;
uniform float u_flares;
uniform vec2 u_pan;
uniform vec2 u_rotation;
uniform int u_pattern;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float sdSphere(vec3 p, float s) {
  return length(p) - s;
}

float map(vec3 p) {
    p.xz *= rot(u_time * 0.5 + 0.5);
    p.xy *= rot(u_time * 0.3 + 0.3);
    
    p.yz *= rot(u_rotation.x);
    p.xz *= rot(u_rotation.y);
    
    if (u_resonance > 0.0) {
        // Creates a pulsating, vibrating effect on the surface
        p += normalize(p) * sin(length(p) * 15.0 - u_time * (8.0 * u_resonanceTempo)) * (0.05 * u_resonance);
    }
    
    if (u_liquidWarp > 0.0) {
        float speed = u_warpSpeed;
        p.x += sin(p.y * 5.0 + u_time * speed) * 0.1 * u_liquidWarp;
        p.y += cos(p.z * 5.0 + u_time * speed) * 0.1 * u_liquidWarp;
        p.z += sin(p.x * 5.0 + u_time * speed) * 0.1 * u_liquidWarp;
    }
    
    return sdSphere(p, 0.6);
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(1.0, -1.0) * 0.5773 * 0.001;
    return normalize(e.xyy*map(p + e.xyy) + 
                     e.yyx*map(p + e.yyx) + 
                     e.yxy*map(p + e.yxy) + 
                     e.xxx*map(p + e.xxx));
}

float bayer4(vec2 p) {
    vec2 m = floor(mod(p, 4.0));
    float res = 0.0;
    if (m.x == 0.0) {
        if (m.y == 0.0) res = 0.0; else if (m.y == 1.0) res = 12.0; else if (m.y == 2.0) res = 3.0; else res = 15.0;
    } else if (m.x == 1.0) {
        if (m.y == 0.0) res = 8.0; else if (m.y == 1.0) res = 4.0; else if (m.y == 2.0) res = 11.0; else res = 7.0;
    } else if (m.x == 2.0) {
        if (m.y == 0.0) res = 2.0; else if (m.y == 1.0) res = 14.0; else if (m.y == 2.0) res = 1.0; else res = 13.0;
    } else {
        if (m.y == 0.0) res = 10.0; else if (m.y == 1.0) res = 6.0; else if (m.y == 2.0) res = 9.0; else res = 5.0;
    }
    return res / 16.0;
}

float ign(vec2 p) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(p, magic.xy)));
}

float getSparks(vec2 uv, float time) {
    vec2 p = uv * 8.0;
    float s = 0.0;
    for(int i=0; i<3; i++) {
        vec2 id = floor(p);
        vec2 f = fract(p) - 0.5;
        float n = rand(id + float(i)*13.37);
        if (n > 0.5) {
            float blink = pow(sin(time * (2.0 + n*4.0) + n * 123.4) * 0.5 + 0.5, 8.0);
            float star = 0.01 / (abs(f.x) + 0.01) + 0.01 / (abs(f.y) + 0.01);
            vec2 diag = rotate(f, 0.785398);
            star += 0.005 / (abs(diag.x) + 0.01) + 0.005 / (abs(diag.y) + 0.01);
            star *= exp(-length(f) * 5.0);
            s += star * blink * (n - 0.5) * 2.0;
        }
        p *= 1.7;
        p = rotate(p, 0.785398);
    }
    return s;
}

float halftone(vec2 uv, float angle, float freq, float intensity) {
    vec2 p = rotate(uv, angle);
    float patternVal = 0.0;
    
    if (u_pattern == 1) {
        patternVal = sin(p.x * freq) * 0.5 + 0.5;
    } else if (u_pattern == 2) {
        patternVal = (sin(p.x * freq) + sin(p.y * freq)) * 0.25 + 0.5;
    } else if (u_pattern == 3) {
        vec2 bayerUv = floor(uv * u_resolution.y / max(u_dotSize * 0.2, 1.0));
        patternVal = bayer4(bayerUv);
        return step(patternVal, clamp(intensity, 0.0, 1.0));
    } else if (u_pattern == 4) {
        vec2 randUv = floor(uv * u_resolution.y / max(u_dotSize * 0.2, 1.0));
        patternVal = rand(randUv);
        return step(patternVal, clamp(intensity, 0.0, 1.0));
    } else if (u_pattern == 5) {
        vec2 ignUv = floor(uv * u_resolution.y / max(u_dotSize * 0.2, 1.0));
        patternVal = ign(ignUv);
        return step(patternVal, clamp(intensity, 0.0, 1.0));
    } else {
        patternVal = (sin(p.x * freq) * sin(p.y * freq)) * 0.5 + 0.5;
    }
    
    patternVal += (rand(uv) - 0.5) * u_noise;
    return step(patternVal, clamp(intensity, 0.0, 1.0));
}

vec4 rgb2cmyk(vec3 rgb) {
    float k = 1.0 - max(max(rgb.r, rgb.g), rgb.b);
    float c = (1.0 - rgb.r - k) / (1.0 - k + 0.0001);
    float m = (1.0 - rgb.g - k) / (1.0 - k + 0.0001);
    float y = (1.0 - rgb.b - k) / (1.0 - k + 0.0001);
    return vec4(c, m, y, k);
}

vec3 cmyk2rgb(vec4 cmyk) {
    float r = (1.0 - cmyk.x) * (1.0 - cmyk.w);
    float g = (1.0 - cmyk.y) * (1.0 - cmyk.w);
    float b = (1.0 - cmyk.z) * (1.0 - cmyk.w);
    return vec3(r, g, b);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 aspectUv = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    
    vec3 ro = vec3(-u_pan.x, -u_pan.y, 2.5 / u_zoom);
    vec3 rd = normalize(vec3(aspectUv, -1.0));

    float t = 0.0;
    float max_t = 10.0;
    for(int i = 0; i < 64; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if(d < 0.001 || t > max_t) break;
        t += d;
    }

    vec3 baseColor = u_bgColor;
    vec2 htUv = aspectUv;
    
    if(t < max_t) {
        vec3 p = ro + rd * t;
        vec3 normal = calcNormal(p);
        
        float u = atan(normal.x, normal.z) / 3.14159;
        float v = asin(normal.y) / 1.57079;
        htUv = mix(aspectUv, vec2(u, v) * 0.5, u_distortion);

        vec3 l1 = normalize(u_lightDir1);
        vec3 l2 = normalize(u_lightDir2);
        
        l1.xz *= rot(u_time);
        l2.xy *= rot(-u_time * 0.7);
        
        float diff1 = dot(normal, l1) * 0.5 + 0.5;
        float diff2 = dot(normal, l2) * 0.5 + 0.5;

        float edge1 = mix(0.5, 0.001, u_sharpness1);
        float edge2 = mix(0.5, 0.001, u_sharpness2);
        
        diff1 = smoothstep(0.5 - edge1, 0.5 + edge1, diff1);
        diff2 = smoothstep(0.5 - edge2, 0.5 + edge2, diff2);

        baseColor = mix(u_color1, u_color2, diff1);
        baseColor = mix(baseColor, u_color3, diff2);
    } else {
        baseColor = mix(u_bgColor, u_color1, uv.y * 0.3);
    }

    float freq = u_resolution.y / u_dotSize;
    vec3 finalColor = baseColor;
    
    vec2 shift = vec2(u_chromaticAberration * 0.02, 0.0);

    if (u_mode == 0) {
        vec4 cmyk = rgb2cmyk(baseColor);
        float c = halftone(htUv + shift, u_angle + 0.261799, freq, cmyk.x);
        float m = halftone(htUv, u_angle + 1.308996, freq, cmyk.y);
        float y = halftone(htUv - shift, u_angle + 0.0, freq, cmyk.z);
        float k = halftone(htUv, u_angle + 0.785398, freq, cmyk.w);
        finalColor = cmyk2rgb(vec4(c, m, y, k)) * u_paperColor;
    } else if (u_mode == 1) {
        float r = halftone(htUv + shift, u_angle + 0.261799, freq, baseColor.r);
        float g = halftone(htUv, u_angle + 1.308996, freq, baseColor.g);
        float b = halftone(htUv - shift, u_angle + 0.0, freq, baseColor.b);
        finalColor = vec3(r, g, b);
    } else {
        float lum = dot(baseColor, vec3(0.299, 0.587, 0.114));
        float dotMaskR = halftone(htUv + shift, u_angle, freq, 1.0 - lum);
        float dotMaskG = halftone(htUv, u_angle, freq, 1.0 - lum);
        float dotMaskB = halftone(htUv - shift, u_angle, freq, 1.0 - lum);
        
        vec3 mask = vec3(dotMaskR, dotMaskG, dotMaskB);
        finalColor = mix(u_paperColor, vec3(0.0), mask);
    }

    finalColor += (rand(uv + u_time) - 0.5) * 0.05;

    if (u_flares > 0.0) {
        float preLuma = dot(baseColor, vec3(0.2126, 0.7152, 0.0722));
        float sparkThreshold = 0.6;
        float intensity = smoothstep(sparkThreshold, 1.0, preLuma);
        if (intensity > 0.0) {
            float s = getSparks(aspectUv + u_pan, u_time);
            finalColor += baseColor * s * u_flares * 15.0 * intensity;
        }
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- Palettes ---
const COLOR_PALETTES = [
  { name: "Neon Nights", colors: ['#ff00ff', '#00ffff', '#000000', '#110022'] },
  { name: "Sunset", colors: ['#ff4500', '#ff8c00', '#8b0000', '#2b0000'] },
  { name: "Forest", colors: ['#2e8b57', '#9acd32', '#006400', '#001a00'] },
  { name: "Cyberpunk", colors: ['#fcee0a', '#ff003c', '#00f0ff', '#050014'] },
  { name: "Monochrome", colors: ['#ffffff', '#888888', '#000000', '#000000'] },
  { name: "Vaporwave", colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff'] },
];

// --- Presets ---
const PRESETS = [
  {
    name: "Cyberpunk Orb",
    color1: '#ff003c',
    color2: '#00f0ff',
    color3: '#fcee0a',
    bgColor: '#050014',
    paperColor: '#ffffff',
    light1: { x: 1, y: 1, z: 0.5 },
    sharpness1: 0.9,
    light2: { x: -1, y: -1, z: 0.0 },
    sharpness2: 0.8,
    dotSize: 4.0,
    angle: 0.5,
    noise: 0.1,
    distortion: 0.2,
    liquidWarp: 0.0,
    warpSpeed: 2.0,
    chromaticAberration: 0.8,
    resonance: 0.0,
    flares: 0.5,
    colorSpeed: 2.5,
    zoom: 1.2,
    mode: 1
  },
  {
    name: "Vintage Comic",
    color1: '#ff0000',
    color2: '#0000ff',
    color3: '#ffff00',
    bgColor: '#ffffff',
    paperColor: '#f0f0e6',
    light1: { x: 0.5, y: 1, z: 0.2 },
    sharpness1: 0.3,
    light2: { x: -0.5, y: -0.5, z: 0.8 },
    sharpness2: 0.4,
    dotSize: 8.0,
    angle: 0.26,
    noise: 0.0,
    distortion: 0.9,
    liquidWarp: 0.0,
    warpSpeed: 2.0,
    chromaticAberration: 0.2,
    resonance: 0.0,
    flares: 0.0,
    colorSpeed: 2.5,
    zoom: 1.0,
    mode: 0
  },
  {
    name: "Liquid Pearl",
    color1: '#ffb3ba',
    color2: '#baffc9',
    color3: '#bae1ff',
    bgColor: '#fdf9ff',
    paperColor: '#ffffff',
    light1: { x: 0, y: 1, z: 0.5 },
    sharpness1: 0.0,
    light2: { x: 0, y: -1, z: 0.5 },
    sharpness2: 0.0,
    dotSize: 2.0,
    angle: 0.78,
    noise: 0.5,
    distortion: 0.5,
    liquidWarp: 0.8,
    warpSpeed: 1.5,
    chromaticAberration: 0.0,
    resonance: 0.2,
    flares: 0.0,
    colorSpeed: 4.0,
    zoom: 1.1,
    mode: 1
  },
  {
    name: "Toxic Glitch",
    color1: '#39ff14',
    color2: '#ff00ff',
    color3: '#000000',
    bgColor: '#111111',
    paperColor: '#ffffff',
    light1: { x: 1, y: 0, z: 0.5 },
    sharpness1: 1.0,
    light2: { x: -1, y: 0, z: 0.5 },
    sharpness2: 1.0,
    dotSize: 3.0,
    angle: 0.0,
    noise: 0.8,
    distortion: 1.0,
    liquidWarp: 0.5,
    warpSpeed: 4.0,
    chromaticAberration: 1.0,
    resonance: 0.8,
    flares: 1.0,
    colorSpeed: 1.0,
    zoom: 1.4,
    mode: 1
  },
  {
    name: "Stippled Void",
    color1: '#ffffff',
    color2: '#888888',
    color3: '#222222',
    bgColor: '#000000',
    paperColor: '#ffffff', // Fixed: was black, causing the whole screen to be black
    light1: { x: 1, y: 1, z: 1 },
    sharpness1: 0.2,
    light2: { x: -1, y: -1, z: 0 },
    sharpness2: 0.1,
    dotSize: 1.5,
    angle: 0.0,
    noise: 1.0,
    distortion: 0.0,
    liquidWarp: 0.0,
    warpSpeed: 2.0,
    chromaticAberration: 0.0,
    resonance: 0.0,
    flares: 0.0,
    colorSpeed: 2.5,
    zoom: 1.0,
    mode: 2
  }
];

// --- UI Components ---
const Slider = ({ label, value, min, max, step, onChange }: any) => (
  <div className="mb-4">
    <div className="flex justify-between text-xs mb-1 text-zinc-400">
      <label>{label}</label>
      <span>{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
    />
  </div>
);

const ColorPicker = ({ label, value, onChange }: any) => (
  <div className="flex items-center justify-between mb-2 bg-zinc-800/50 p-2 rounded-md border border-zinc-800">
    <label className="text-xs text-zinc-400">{label}</label>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
    />
  </div>
);

// --- Main App ---
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomCanvasRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const p = urlParams.get('p');
    if (p) {
      const decoded = decodeParams(p);
      if (decoded) return decoded;
    }
    return PRESETS[0];
  });
  const [animate, setAnimate] = useState(false);
  const [animateColors, setAnimateColors] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1);
  const [copied, setCopied] = useState(false);
  
  const paramsRef = useRef(params);
  const animateRef = useRef(animate);
  const pixelRatioRef = useRef(pixelRatio);
  
  const interactionRef = useRef({
    isDragging: false,
    dragMode: null as 'pan' | 'rotate' | null,
    lastX: 0,
    lastY: 0,
    panX: 0,
    panY: 0,
    rotX: 0,
    rotY: 0
  });

  useEffect(() => {
    paramsRef.current = params;
    
    // Sync to URL with debounce
    const timeoutId = setTimeout(() => {
      const encoded = encodeParams(params);
      const newUrl = window.location.pathname + '?p=' + encoded;
      window.history.replaceState(null, '', newUrl);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [params]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useEffect(() => {
    pixelRatioRef.current = pixelRatio;
  }, [pixelRatio]);

  const randomizeColors = () => {
    const palette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    const shuffled = [...palette.colors].sort(() => 0.5 - Math.random());
    setParams(p => ({
      ...p,
      color1: shuffled[0],
      color2: shuffled[1],
      color3: shuffled[2],
      bgColor: shuffled[3],
    }));
  };

  useEffect(() => {
    if (!animateColors) return;
    const interval = setInterval(() => {
      randomizeColors();
    }, (params.colorSpeed || 2.5) * 1000);
    return () => clearInterval(interval);
  }, [animateColors, params.colorSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) return;

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      u_resolution: gl.getUniformLocation(program, 'u_resolution'),
      u_time: gl.getUniformLocation(program, 'u_time'),
      u_color1: gl.getUniformLocation(program, 'u_color1'),
      u_color2: gl.getUniformLocation(program, 'u_color2'),
      u_color3: gl.getUniformLocation(program, 'u_color3'),
      u_bgColor: gl.getUniformLocation(program, 'u_bgColor'),
      u_paperColor: gl.getUniformLocation(program, 'u_paperColor'),
      u_lightDir1: gl.getUniformLocation(program, 'u_lightDir1'),
      u_lightDir2: gl.getUniformLocation(program, 'u_lightDir2'),
      u_sharpness1: gl.getUniformLocation(program, 'u_sharpness1'),
      u_sharpness2: gl.getUniformLocation(program, 'u_sharpness2'),
      u_dotSize: gl.getUniformLocation(program, 'u_dotSize'),
      u_angle: gl.getUniformLocation(program, 'u_angle'),
      u_noise: gl.getUniformLocation(program, 'u_noise'),
      u_distortion: gl.getUniformLocation(program, 'u_distortion'),
      u_zoom: gl.getUniformLocation(program, 'u_zoom'),
      u_mode: gl.getUniformLocation(program, 'u_mode'),
      u_liquidWarp: gl.getUniformLocation(program, 'u_liquidWarp'),
      u_warpSpeed: gl.getUniformLocation(program, 'u_warpSpeed'),
      u_chromaticAberration: gl.getUniformLocation(program, 'u_chromaticAberration'),
      u_resonance: gl.getUniformLocation(program, 'u_resonance'),
      u_resonanceTempo: gl.getUniformLocation(program, 'u_resonanceTempo'),
      u_flares: gl.getUniformLocation(program, 'u_flares'),
      u_pan: gl.getUniformLocation(program, 'u_pan'),
      u_rotation: gl.getUniformLocation(program, 'u_rotation'),
      u_pattern: gl.getUniformLocation(program, 'u_pattern'),
    };

    let animationFrameId: number;
    let lastTime = Date.now();
    let accumulatedTime = 0;

    const renderState = {
      color1: hex2rgb(paramsRef.current.color1),
      color2: hex2rgb(paramsRef.current.color2),
      color3: hex2rgb(paramsRef.current.color3),
      bgColor: hex2rgb(paramsRef.current.bgColor),
      paperColor: hex2rgb(paramsRef.current.paperColor),
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const lerpRGB = (c1: number[], c2: number[], t: number) => [
      lerp(c1[0], c2[0], t),
      lerp(c1[1], c2[1], t),
      lerp(c1[2], c2[2], t)
    ];

    const render = () => {
      const currentPixelRatio = pixelRatioRef.current;
      let displayWidth = Math.floor(canvas.clientWidth * currentPixelRatio);
      let displayHeight = Math.floor(canvas.clientHeight * currentPixelRatio);
      
      const maxDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      if (maxDims) {
        const maxDimX = maxDims[0];
        const maxDimY = maxDims[1];
        if (displayWidth > maxDimX || displayHeight > maxDimY) {
          const scaleX = maxDimX / displayWidth;
          const scaleY = maxDimY / displayHeight;
          const scale = Math.min(scaleX, scaleY);
          displayWidth = Math.floor(displayWidth * scale);
          displayHeight = Math.floor(displayHeight * scale);
        }
      }
      
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      gl.useProgram(program);

      const currentParams = paramsRef.current;

      const t = 0.05;
      renderState.color1 = lerpRGB(renderState.color1, hex2rgb(currentParams.color1), t);
      renderState.color2 = lerpRGB(renderState.color2, hex2rgb(currentParams.color2), t);
      renderState.color3 = lerpRGB(renderState.color3, hex2rgb(currentParams.color3), t);
      renderState.bgColor = lerpRGB(renderState.bgColor, hex2rgb(currentParams.bgColor), t);
      renderState.paperColor = lerpRGB(renderState.paperColor, hex2rgb(currentParams.paperColor), t);

      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;
      
      if (animateRef.current) {
        accumulatedTime += dt;
      }

      gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.u_time, accumulatedTime / 1000);
      
      gl.uniform3fv(uniforms.u_color1, renderState.color1);
      gl.uniform3fv(uniforms.u_color2, renderState.color2);
      gl.uniform3fv(uniforms.u_color3, renderState.color3);
      gl.uniform3fv(uniforms.u_bgColor, renderState.bgColor);
      gl.uniform3fv(uniforms.u_paperColor, renderState.paperColor);
      
      gl.uniform3f(uniforms.u_lightDir1, currentParams.light1.x, currentParams.light1.y, currentParams.light1.z);
      gl.uniform3f(uniforms.u_lightDir2, currentParams.light2.x, currentParams.light2.y, currentParams.light2.z);
      gl.uniform1f(uniforms.u_sharpness1, currentParams.sharpness1);
      gl.uniform1f(uniforms.u_sharpness2, currentParams.sharpness2);
      
      gl.uniform1f(uniforms.u_dotSize, currentParams.dotSize * currentPixelRatio);
      gl.uniform1f(uniforms.u_angle, currentParams.angle);
      gl.uniform1f(uniforms.u_noise, currentParams.noise);
      gl.uniform1f(uniforms.u_distortion, currentParams.distortion);
      gl.uniform1f(uniforms.u_zoom, currentParams.zoom || 1.0);
      gl.uniform1i(uniforms.u_mode, currentParams.mode);
      gl.uniform1i(uniforms.u_pattern, currentParams.pattern ?? 0);
      gl.uniform1f(uniforms.u_liquidWarp, currentParams.liquidWarp || 0.0);
      gl.uniform1f(uniforms.u_warpSpeed, currentParams.warpSpeed || 2.0);
      gl.uniform1f(uniforms.u_chromaticAberration, currentParams.chromaticAberration || 0.0);
      gl.uniform1f(uniforms.u_resonance, currentParams.resonance || 0.0);
      gl.uniform1f(uniforms.u_resonanceTempo, currentParams.resonanceTempo ?? 1.0);
      gl.uniform1f(uniforms.u_flares, currentParams.flares || 0.0);
      
      gl.uniform2f(uniforms.u_pan, interactionRef.current.panX, interactionRef.current.panY);
      gl.uniform2f(uniforms.u_rotation, interactionRef.current.rotX, interactionRef.current.rotY);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const bloomCanvas = bloomCanvasRef.current;
      if (bloomCanvas && (currentParams.bloomIntensity || 0) > 0) {
        if (bloomCanvas.width !== canvas.width || bloomCanvas.height !== canvas.height) {
          bloomCanvas.width = canvas.width;
          bloomCanvas.height = canvas.height;
        }
        const ctx = bloomCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
    };
  }, []);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const bloomCanvas = bloomCanvasRef.current;
    if (!canvas) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    
    // Draw base
    ctx.drawImage(canvas, 0, 0);
    
    // Draw bloom if active
    if (bloomCanvas && (params.bloomIntensity || 0) > 0) {
      ctx.globalAlpha = params.bloomIntensity || 0;
      const blendMode = params.bloomBlendMode || 'plus-lighter';
      ctx.globalCompositeOperation = blendMode === 'plus-lighter' ? 'lighter' : blendMode as any;
      ctx.filter = `blur(${params.bloomRadius ?? 40}px)`;
      ctx.drawImage(bloomCanvas, 0, 0);
    }
    
    const link = document.createElement('a');
    link.download = 'halftone-art.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };
  
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    interactionRef.current.isDragging = true;
    interactionRef.current.lastX = e.clientX;
    interactionRef.current.lastY = e.clientY;
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      interactionRef.current.dragMode = 'pan';
    } else if (e.button === 0) {
      interactionRef.current.dragMode = 'rotate';
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactionRef.current.isDragging) return;
    const dx = e.clientX - interactionRef.current.lastX;
    const dy = e.clientY - interactionRef.current.lastY;
    interactionRef.current.lastX = e.clientX;
    interactionRef.current.lastY = e.clientY;
    
    if (interactionRef.current.dragMode === 'rotate') {
      interactionRef.current.rotY -= dx * 0.01;
      interactionRef.current.rotX += dy * 0.01;
    } else if (interactionRef.current.dragMode === 'pan') {
      interactionRef.current.panX += dx * 0.002;
      interactionRef.current.panY -= dy * 0.002;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    interactionRef.current.isDragging = false;
    interactionRef.current.dragMode = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = () => {
    interactionRef.current.panX = 0;
    interactionRef.current.panY = 0;
    interactionRef.current.rotX = 0;
    interactionRef.current.rotY = 0;
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={`w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto z-10 shadow-xl custom-scrollbar ${isFullscreen ? 'hidden' : 'flex'}`}>
        <div className="p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900/95 backdrop-blur z-20 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-medium flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-400" />
              Halftone Sim
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Generative moire & stipple</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setAnimateColors(!animateColors)}
              className={`p-2 rounded-full transition-colors ${animateColors ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title={animateColors ? "Stop Color Animation" : "Animate Colors"}
            >
              <Activity className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setAnimate(!animate)}
              className={`p-2 rounded-full transition-colors ${animate ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title={animate ? "Pause Animation" : "Play Animation"}
            >
              {animate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Presets */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Presets</h2>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setParams(p)}
                  className="px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-md text-left transition-colors flex items-center gap-2 text-zinc-300 border border-transparent hover:border-zinc-600"
                >
                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          {/* Colors */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Colors</h2>
              <button 
                onClick={randomizeColors}
                className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                title="Randomize from Palettes"
              >
                <Palette className="w-3 h-3" /> Randomize
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <ColorPicker label="Color 1" value={params.color1} onChange={(v: string) => setParams({ ...params, color1: v })} />
              <ColorPicker label="Color 2" value={params.color2} onChange={(v: string) => setParams({ ...params, color2: v })} />
              <ColorPicker label="Color 3" value={params.color3} onChange={(v: string) => setParams({ ...params, color3: v })} />
              <ColorPicker label="Bg Base" value={params.bgColor} onChange={(v: string) => setParams({ ...params, bgColor: v })} />
              <ColorPicker label="Paper" value={params.paperColor} onChange={(v: string) => setParams({ ...params, paperColor: v })} />
            </div>
            <Slider label="Color Shift Speed (s)" value={params.colorSpeed || 2.5} min={0.1} max={5.0} step={0.1} onChange={(v: number) => setParams({ ...params, colorSpeed: v })} />
          </section>

          {/* Halftone */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Halftone</h2>
            <div className="mb-4">
              <label className="text-xs text-zinc-400 block mb-1">Color Mode</label>
              <select
                value={params.mode}
                onChange={(e) => setParams({ ...params, mode: parseInt(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-zinc-200"
              >
                <option value={0}>CMYK Print</option>
                <option value={1}>RGB Screen</option>
                <option value={2}>Monochrome</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs text-zinc-400 block mb-1">Pattern</label>
              <select
                value={params.pattern ?? 0}
                onChange={(e) => setParams({ ...params, pattern: parseInt(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-zinc-200"
              >
                <option value={0}>Dots</option>
                <option value={1}>Lines</option>
                <option value={2}>Crosshatch</option>
                <option value={3}>Bayer Dither</option>
                <option value={4}>Random Dither</option>
                <option value={5}>Blue Noise</option>
              </select>
            </div>
            <Slider label="Dot Size" value={params.dotSize} min={1} max={20} step={0.1} onChange={(v: number) => setParams({ ...params, dotSize: v })} />
            <Slider label="Angle" value={params.angle} min={0} max={Math.PI} step={0.01} onChange={(v: number) => setParams({ ...params, angle: v })} />
            <Slider label="Noise (Grain)" value={params.noise} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, noise: v })} />
          </section>

          {/* Shape & Camera */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Shape & Camera</h2>
            <Slider label="Zoom" value={params.zoom || 1} min={0.5} max={3} step={0.01} onChange={(v: number) => setParams({ ...params, zoom: v })} />
            <Slider label="3D Distortion" value={params.distortion} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, distortion: v })} />
          </section>

          {/* Effects */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Effects</h2>
            <Slider label="Liquid Warp" value={params.liquidWarp || 0} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, liquidWarp: v })} />
            <Slider label="Warp Speed" value={params.warpSpeed || 2.0} min={0} max={5} step={0.1} onChange={(v: number) => setParams({ ...params, warpSpeed: v })} />
            <Slider label="Pulse" value={params.resonance || 0} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, resonance: v })} />
            <Slider label="Pulse Tempo" value={params.resonanceTempo ?? 1.0} min={0.1} max={5} step={0.1} onChange={(v: number) => setParams({ ...params, resonanceTempo: v })} />
            <Slider label="Mist (Bloom) Intensity" value={params.bloomIntensity || 0} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, bloomIntensity: v })} />
            <Slider label="Mist Radius" value={params.bloomRadius ?? 40} min={0} max={100} step={1} onChange={(v: number) => setParams({ ...params, bloomRadius: v })} />
            <div className="mb-4">
              <label className="text-xs text-zinc-400 block mb-1">Mist Blend Mode</label>
              <select
                value={params.bloomBlendMode || 'plus-lighter'}
                onChange={(e) => setParams({ ...params, bloomBlendMode: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-zinc-200"
              >
                <option value="plus-lighter">Additive (Plus Lighter)</option>
                <option value="screen">Screen (Soft Glow)</option>
                <option value="color-dodge">Color Dodge (Intense)</option>
              </select>
            </div>
            <Slider label="Chromatic Aberration" value={params.chromaticAberration || 0} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, chromaticAberration: v })} />
            <Slider label="Flares & Sparks" value={params.flares || 0} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, flares: v })} />
          </section>

          {/* Lighting */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Lighting</h2>
            <Slider label="Sharpness 1" value={params.sharpness1} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, sharpness1: v })} />
            <Slider label="Sharpness 2" value={params.sharpness2} min={0} max={1} step={0.01} onChange={(v: number) => setParams({ ...params, sharpness2: v })} />
          </section>
        </div>
      </div>

      {/* Main Area */}
      <div className={`flex-1 relative flex flex-col items-center justify-center bg-zinc-950 ${isFullscreen ? 'fixed inset-0 z-50' : 'p-8'}`}>
        <div className="absolute top-6 right-6 z-10 flex gap-2">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-1 shadow-lg">
            <span className="text-xs text-zinc-400 px-2">Resolution:</span>
            {[0.5, 1, 2, 4, 16].map(ratio => (
              <button
                key={ratio}
                onClick={() => setPixelRatio(ratio)}
                className={`px-2 py-1 text-xs rounded transition-colors ${pixelRatio === ratio ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
              >
                {ratio}x
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center justify-center w-9 h-9 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-md transition-colors shadow-lg"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors shadow-lg"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <LinkIcon className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20"
          >
            <Download className="w-4 h-4" />
            Export PNG
          </button>
        </div>
        
        <div className={`relative shadow-2xl shadow-black/80 overflow-hidden border border-zinc-800/50 ${isFullscreen ? 'w-full h-full rounded-none border-0' : 'w-full max-w-2xl aspect-[3/4] rounded-sm'}`}>
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full bg-zinc-900 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
          />
          <canvas
            ref={bloomCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              filter: `blur(${params.bloomRadius ?? 40}px)`,
              mixBlendMode: (params.bloomBlendMode as any) || 'plus-lighter',
              opacity: params.bloomIntensity || 0
            }}
          />
        </div>
      </div>
    </div>
  );
}
