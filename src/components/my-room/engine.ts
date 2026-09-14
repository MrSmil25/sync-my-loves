export type MyRoomTheme = "light" | "dark";

export type MyRoomEngineOptions = {
  logoUrl: string;
  theme: MyRoomTheme;
  paused: boolean;
};

export type MyRoomEngineHandle = {
  setPaused: (paused: boolean) => void;
  setTheme: (theme: MyRoomTheme) => void;
  transitionToLogin: (done: () => void) => void;
  destroy: () => void;
};

type LogoSprite = {
  texture: WebGLTexture;
  sample: HTMLCanvasElement;
};

type Particle = {
  source: 0 | 1;
  u: number;
  v: number;
  angle: number;
  radius: number;
  size: number;
  alpha: number;
  color: string;
};

const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform float uSize;
uniform float uSpin;
uniform float uTilt;
uniform float uDepth;
varying vec2 vUv;
varying float vShade;
void main() {
  float cy = cos(uSpin), sy = sin(uSpin);
  float cx = cos(uTilt), sx = sin(uTilt);
  vec3 p = vec3(aPosition.x, aPosition.y, 0.0);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  float perspective = uDepth / (uDepth - p.z * uSize);
  vec2 screen = uCenter + vec2(p.x, -p.y) * uSize * perspective;
  gl_Position = vec4(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0, 0.0, 1.0);
  vUv = aUv;
  vShade = .74 + .26 * abs(cy);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D uTexture;
uniform float uAlpha;
uniform float uLight;
varying vec2 vUv;
varying float vShade;
void main() {
  vec4 color = texture2D(uTexture, vUv);
  if (color.a < .025) discard;
  float lift = uLight * .07;
  gl_FragColor = vec4(min(vec3(1.0), color.rgb * vShade + lift), color.a * uAlpha);
}`;

function makeNeutralLogo(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const gradient = context.createLinearGradient(60, 40, 450, 470);
  gradient.addColorStop(0, "#183f91");
  gradient.addColorStop(0.55, "#3663d4");
  gradient.addColorStop(1, "#27b8e8");
  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(42, 42, 428, 428, 108);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.36)";
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "600 270px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("M", 256, 280);
  return canvas;
}

function imageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.clearRect(0, 0, 512, 512);
  context.drawImage(image, 26, 26, 460, 460);
  return canvas;
}

export function createMyRoomEngine(
  root: HTMLElement,
  options: MyRoomEngineOptions,
): MyRoomEngineHandle {
  const stageNode = root.querySelector<HTMLElement>("[data-my-room-stage]");
  const ambientNode = root.querySelector<HTMLCanvasElement>("[data-ambient-canvas]");
  const logoNode = root.querySelector<HTMLCanvasElement>("[data-logo-canvas]");
  const particleNode = root.querySelector<HTMLCanvasElement>("[data-particle-canvas]");
  if (!stageNode || !ambientNode || !logoNode || !particleNode) {
    throw new Error("My Room canvas elements are unavailable");
  }
  const stage: HTMLElement = stageNode;
  const ambientCanvas: HTMLCanvasElement = ambientNode;
  const logoCanvas: HTMLCanvasElement = logoNode;
  const particleCanvas: HTMLCanvasElement = particleNode;

  let destroyed = false;
  let paused = options.paused;
  let theme = options.theme;
  let width = 1;
  let height = 1;
  let ratio = 1;
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let pointerX = 0;
  let pointerY = 0;
  let easedX = 0;
  let easedY = 0;
  let spin = 0;
  let tilt = 0;
  let velocity = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragLastX = 0;
  let dragLastY = 0;
  let transitionStart = 0;
  let transitionDone: (() => void) | null = null;
  let sprites: [LogoSprite, LogoSprite] | null = null;
  let particles: Particle[] = [];
  const abort = new AbortController();
  const ambient = ambientCanvas.getContext("2d");
  const particleContext = particleCanvas.getContext("2d");
  const gl = logoCanvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });

  const dust = Array.from({ length: 68 }, (_, index) => ({
    x: ((index * 47) % 101) / 101,
    y: ((index * 71) % 103) / 103,
    phase: index * 0.63,
    size: 0.35 + (index % 7) * 0.11,
  }));

  function resize() {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    for (const canvas of [ambientCanvas, logoCanvas, particleCanvas]) {
      const nextWidth = Math.round(width * ratio);
      const nextHeight = Math.round(height * ratio);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
    }
    gl?.viewport(0, 0, logoCanvas.width, logoCanvas.height);
  }

  function compile(type: number, source: string) {
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const program = gl?.createProgram() ?? null;
  const vertex = gl ? compile(gl.VERTEX_SHADER, VERTEX_SHADER) : null;
  const fragment = gl ? compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER) : null;
  if (gl && program && vertex && fragment) {
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  const positionLocation = gl && program ? gl.getAttribLocation(program, "aPosition") : -1;
  const uvLocation = gl && program ? gl.getAttribLocation(program, "aUv") : -1;
  const uniforms = gl && program
    ? {
        viewport: gl.getUniformLocation(program, "uViewport"),
        center: gl.getUniformLocation(program, "uCenter"),
        size: gl.getUniformLocation(program, "uSize"),
        spin: gl.getUniformLocation(program, "uSpin"),
        tilt: gl.getUniformLocation(program, "uTilt"),
        depth: gl.getUniformLocation(program, "uDepth"),
        alpha: gl.getUniformLocation(program, "uAlpha"),
        light: gl.getUniformLocation(program, "uLight"),
        texture: gl.getUniformLocation(program, "uTexture"),
      }
    : null;

  const geometry = gl?.createBuffer() ?? null;
  if (gl && geometry) {
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.5, -0.5, 0, 1,
        0.5, -0.5, 1, 1,
        -0.5, 0.5, 0, 0,
        -0.5, 0.5, 0, 0,
        0.5, -0.5, 1, 1,
        0.5, 0.5, 1, 0,
      ]),
      gl.STATIC_DRAW,
    );
  }

  function textureFromCanvas(canvas: HTMLCanvasElement): WebGLTexture | null {
    if (!gl) return null;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    return texture;
  }

  function sampleCanvas(canvas: HTMLCanvasElement, source: 0 | 1) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const result: Particle[] = [];
    const targetCount = width < 620 ? 720 : 1200;
    const stride = Math.max(4, Math.floor(Math.sqrt((canvas.width * canvas.height) / targetCount)));
    for (let y = 0; y < canvas.height; y += stride) {
      for (let x = 0; x < canvas.width; x += stride) {
        const offset = (y * canvas.width + x) * 4;
        const alpha = image.data[offset + 3] / 255;
        if (alpha < 0.2 || ((x + y) / stride) % 2 > 0.8) continue;
        result.push({
          source,
          u: x / canvas.width - 0.5,
          v: y / canvas.height - 0.5,
          angle: (x * 0.031 + y * 0.017) % (Math.PI * 2),
          radius: 32 + ((x * 13 + y * 7) % 150),
          size: 0.7 + ((x + y) % 5) * 0.17,
          alpha,
          color: `rgb(${image.data[offset]},${image.data[offset + 1]},${image.data[offset + 2]})`,
        });
        if (result.length >= targetCount) return result;
      }
    }
    return result;
  }

  const neutralCanvas = makeNeutralLogo();
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    if (destroyed || !gl) return;
    const brandCanvas = imageToCanvas(image);
    const first = textureFromCanvas(brandCanvas);
    const second = textureFromCanvas(neutralCanvas);
    if (!first || !second) return;
    sprites = [
      { texture: first, sample: brandCanvas },
      { texture: second, sample: neutralCanvas },
    ];
    stage.classList.add("mr-webgl-ready");
    particles = [...sampleCanvas(brandCanvas, 0), ...sampleCanvas(neutralCanvas, 1)];
    schedule();
  };
  image.src = options.logoUrl;

  function logoPose(index: number) {
    const size = Math.min(190, width * 0.27, height * 0.245);
    const separation = Math.min(148, width * 0.205);
    const direction = index === 0 ? -1 : 1;
    const transition = transitionStart ? Math.min(1, (performance.now() - transitionStart) / 900) : 0;
    const eased = 1 - Math.pow(1 - transition, 3);
    return {
      x: width / 2 + direction * separation * (1 - eased * 0.72),
      y: height * 0.5 - eased * height * 0.3 + Math.sin(clock * 0.75 + index * 1.8) * (paused ? 0 : 5),
      size: size * (1 - eased * 0.68),
      spin: spin + direction * 0.12 + Math.sin(clock * 0.42) * 0.1,
      tilt: tilt + eased * 0.12,
      alpha: 1 - eased * 0.72,
    };
  }

  function drawLogos() {
    if (!gl || !program || !geometry || !uniforms || !sprites) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);
    gl.uniform2f(uniforms.viewport, width, height);
    gl.uniform1f(uniforms.depth, 2.5);
    gl.uniform1f(uniforms.light, theme === "light" ? 1 : 0);
    gl.uniform1i(uniforms.texture, 0);
    sprites.forEach((sprite, index) => {
      const pose = logoPose(index);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sprite.texture);
      gl.uniform2f(uniforms.center, pose.x, pose.y);
      gl.uniform1f(uniforms.size, pose.size);
      gl.uniform1f(uniforms.spin, pose.spin);
      gl.uniform1f(uniforms.tilt, pose.tilt);
      gl.uniform1f(uniforms.alpha, pose.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
  }

  function drawAmbient() {
    if (!ambient) return;
    ambient.setTransform(ratio, 0, 0, ratio, 0, 0);
    ambient.clearRect(0, 0, width, height);
    const light = theme === "light";
    const cols = width < 620 ? 50 : 88;
    for (let row = 0; row < 13; row += 1) {
      const depth = row / 12;
      ambient.fillStyle = light
        ? `rgba(54,99,212,${0.018 + depth * 0.055})`
        : `rgba(109,150,222,${0.02 + depth * 0.095})`;
      ambient.beginPath();
      for (let col = 0; col < cols; col += 1) {
        const u = col / (cols - 1);
        const x = u * width * 1.16 - width * 0.08 + easedX * depth * 18;
        const wave = Math.sin(u * 9 + clock * 0.18 + depth * 3) * 15 + Math.sin(u * 16 - clock * 0.14) * 5;
        const y = height * 0.8 + depth * depth * height * 0.2 + wave * (0.3 + depth * 0.7);
        ambient.moveTo(x + 0.8, y);
        ambient.arc(x, y, 0.45 + depth * 0.55, 0, Math.PI * 2);
      }
      ambient.fill();
    }
    for (const point of dust) {
      const x = point.x * width + Math.sin(clock * 0.1 + point.phase) * 7 + easedX * 10;
      const y = point.y * height + Math.cos(clock * 0.08 + point.phase) * 8;
      ambient.fillStyle = light ? "rgba(54,99,212,.12)" : "rgba(165,192,237,.13)";
      ambient.beginPath();
      ambient.arc(x, y, point.size, 0, Math.PI * 2);
      ambient.fill();
    }
  }

  function drawParticles(now: number) {
    if (!particleContext) return;
    particleContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    particleContext.clearRect(0, 0, width, height);
    if (!transitionStart || !particles.length) return;
    const progress = Math.min(1, (now - transitionStart) / 900);
    const scatter = Math.sin(progress * Math.PI);
    particleContext.save();
    particleContext.globalCompositeOperation = theme === "light" ? "source-over" : "lighter";
    for (const particle of particles) {
      const pose = logoPose(particle.source);
      const x = pose.x + particle.u * pose.size + Math.cos(particle.angle + progress * 2) * particle.radius * scatter;
      const y = pose.y + particle.v * pose.size + Math.sin(particle.angle + progress * 2) * particle.radius * scatter - scatter * 30;
      particleContext.globalAlpha = particle.alpha * scatter * 0.68;
      particleContext.fillStyle = particle.color;
      particleContext.fillRect(x, y, particle.size, particle.size);
    }
    particleContext.restore();
  }

  function schedule() {
    if (!destroyed && !raf && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    raf = 0;
    if (destroyed || document.hidden) return;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused) {
      clock += delta;
      easedX += (pointerX - easedX) * (1 - Math.exp(-delta * 5));
      easedY += (pointerY - easedY) * (1 - Math.exp(-delta * 5));
      if (!dragging) {
        spin += velocity;
        velocity *= Math.exp(-delta * 6.5);
        tilt *= Math.exp(-delta * 2.5);
      }
    }
    drawAmbient();
    drawLogos();
    drawParticles(now);
    if (transitionStart && now - transitionStart >= 900) {
      const done = transitionDone;
      transitionDone = null;
      transitionStart = 0;
      done?.();
      return;
    }
    if (!paused || transitionStart) schedule();
  }

  function pointerDown(event: PointerEvent) {
    if (paused || transitionStart) return;
    dragging = true;
    dragStartX = event.clientX;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    stage.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent) {
    const bounds = stage.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / width - 0.5;
    pointerY = (event.clientY - bounds.top) / height - 0.5;
    if (dragging && !paused) {
      const deltaX = event.clientX - dragLastX;
      spin += deltaX * 0.01;
      tilt = Math.max(-0.55, Math.min(0.55, tilt + (event.clientY - dragLastY) * 0.004));
      velocity = deltaX * 0.008;
      dragLastX = event.clientX;
      dragLastY = event.clientY;
    }
    schedule();
  }

  function pointerUp(event: PointerEvent) {
    dragging = false;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    schedule();
  }

  stage.addEventListener("pointerdown", pointerDown, { signal: abort.signal });
  stage.addEventListener("pointermove", pointerMove, { passive: true, signal: abort.signal });
  stage.addEventListener("pointerup", pointerUp, { signal: abort.signal });
  stage.addEventListener("pointercancel", pointerUp, { signal: abort.signal });
  stage.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
  }, { signal: abort.signal });
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
    if (!document.hidden) schedule();
  }, { signal: abort.signal });

  const resizeObserver = new ResizeObserver(() => {
    resize();
    schedule();
  });
  resizeObserver.observe(stage);
  resize();
  schedule();

  return {
    setPaused(next) {
      paused = next;
      last = performance.now();
      schedule();
    },
    setTheme(next) {
      theme = next;
      schedule();
    },
    transitionToLogin(done) {
      if (transitionStart) return;
      transitionStart = performance.now();
      transitionDone = done;
      schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      resizeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (gl) {
        if (sprites) sprites.forEach((sprite) => gl.deleteTexture(sprite.texture));
        if (geometry) gl.deleteBuffer(geometry);
        if (program) gl.deleteProgram(program);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      sprites = null;
      particles = [];
      transitionDone = null;
      stage.classList.remove("mr-webgl-ready");
    },
  };
}
