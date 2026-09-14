import { createLogoLayer } from "./logos3d";

export type MyRoomTheme = "light" | "dark";

export type MyRoomEngineOptions = {
  logoUrls: [string, string];
  theme: MyRoomTheme;
  paused: boolean;
  view?: "intro" | "login";
};

export type MyRoomEngineHandle = {
  setPaused: (paused: boolean) => void;
  setTheme: (theme: MyRoomTheme) => void;
  transitionToLogin: (done: () => void) => void;
  exitLogin: (done?: () => void) => void;
  destroy: () => void;
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
  let poseValue = options.view === "login" ? 1 : 0;
  let poseTarget = poseValue;
  let transitionDone: (() => void) | null = null;
  let particles: Particle[] = [];
  const abort = new AbortController();
  const ambient = ambientCanvas.getContext("2d");
  const particleContext = particleCanvas.getContext("2d");
  const layer = createLogoLayer(logoCanvas, options.logoUrls, () => {
    if (destroyed) return;
    stage.classList.add("mr-webgl-ready");
    const first = layer.snapshot(0);
    const second = layer.snapshot(1);
    particles = [
      ...(first ? sampleCanvas(first, 0) : []),
      ...(second ? sampleCanvas(second, 1) : []),
    ];
    resize();
    schedule();
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
    layer.setSize(width, height, ratio);
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
        const alpha = (image.data[offset + 3] ?? 0) / 255;
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


  function logoPose(index: number) {
    const size = Math.min(190, width * 0.27, height * 0.245);
    const separation = Math.min(148, width * 0.205);
    const direction = index === 0 ? -1 : 1;
    const eased = 1 - Math.pow(1 - poseValue, 3);
    return {
      x: width / 2 + direction * separation * (1 - eased * 0.72),
      y: height * 0.5 - eased * height * 0.3 + Math.sin(clock * 0.75 + index * 1.8) * (paused ? 0 : 5),
      size: size * (1 - eased * 0.68),
      spin: spin + direction * 0.12 + Math.sin(clock * 0.42) * 0.1,
      tilt: tilt + eased * 0.12,
      alpha: 1 - eased * 0.28,
    };
  }

  function drawLogos() {
    if (!layer.ready) return;
    layer.render([logoPose(0), logoPose(1)], theme === "light");
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

  function drawParticles() {
    if (!particleContext) return;
    particleContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    particleContext.clearRect(0, 0, width, height);
    if (!particles.length) return;
    const progress = poseValue;
    const scatter = Math.sin(progress * Math.PI);
    if (scatter < 0.01) return;
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
    const rawDelta = Math.max(0, (now - last) / 1000);
    const delta = Math.min(rawDelta, 0.05);
    last = now;
    if (poseValue !== poseTarget) {
      const step = Math.min(rawDelta, 0.25) / 0.9;
      poseValue =
        poseTarget > poseValue
          ? Math.min(poseTarget, poseValue + step)
          : Math.max(poseTarget, poseValue - step);
      if (poseValue === poseTarget) {
        const done = transitionDone;
        transitionDone = null;
        done?.();
      }
    }
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
    drawParticles();
    if (!paused || poseValue !== poseTarget) schedule();
  }

  function pointerDown(event: PointerEvent) {
    if (paused || poseValue !== poseTarget) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, button, a, label, form, .mr-card, .mr-top")) return;
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
      if (poseTarget === 1) {
        done();
        return;
      }
      poseTarget = 1;
      transitionDone = done;
      last = performance.now();
      schedule();
    },
    exitLogin(done) {
      if (poseTarget === 0) {
        done?.();
        return;
      }
      poseTarget = 0;
      transitionDone = done ?? null;
      last = performance.now();
      schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      resizeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      layer.dispose();
      particles = [];
      transitionDone = null;
      stage.classList.remove("mr-webgl-ready");
    },
  };
}
