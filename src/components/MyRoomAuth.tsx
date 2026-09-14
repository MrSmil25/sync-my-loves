import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Moon, Pause, Play, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/Logo_aplikasi_MR.png.asset.json";
import logoRkModel from "@/assets/Logo_RK_3D.glb.asset.json";
import logoUiModel from "@/assets/Logo_UI_3D.glb.asset.json";
import { supabase } from "@/lib/supabase-external";
import {
  createMyRoomEngine,
  type MyRoomEngineHandle,
  type MyRoomTheme,
} from "./my-room/engine";
import "./MyRoomAuth.css";

const THEME_KEY = "my-room-theme";
const SKIP_INTRO_KEY = "my-room-skip-intro";

type AuthMode = "login" | "register" | "forgot";

function readInitialTheme(): MyRoomTheme {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function LogoFallback() {
  return (
    <div className="mr-fallback" aria-hidden="true">
      <div className="mr-fallback-logo mr-fallback-brand">
        <img src={logoAsset.url} alt="" />
      </div>
      <div className="mr-fallback-logo mr-fallback-neutral">M</div>
    </div>
  );
}

function MyRoomHeader({
  paused,
  theme,
  onPause,
  onTheme,
}: {
  paused: boolean;
  theme: MyRoomTheme;
  onPause: () => void;
  onTheme: () => void;
}) {
  return (
    <header className="mr-top">
      <span className="mr-brand">
        <span className="mr-brand-symbol"><img src={logoAsset.url} alt="" /></span>
        My Room
      </span>
      <div className="mr-top-right">
        <span className="mr-top-note">Ruang untuk bertumbuh.</span>
        <Button type="button" variant="ghost" size="icon" className="mr-theme" onClick={onTheme} aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"} title={theme === "dark" ? "Mode terang" : "Mode gelap"}>
          {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
        <Button type="button" variant="ghost" className="mr-motion" onClick={onPause} aria-pressed={paused} aria-label={paused ? "Aktifkan animasi" : "Jeda animasi"}>
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          <span>{paused ? "Aktifkan animasi" : "Jeda animasi"}</span>
        </Button>
      </div>
    </header>
  );
}

const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" aria-hidden="true"><path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6" /></svg>
);
const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.4-3.4 4-5 7-5s5.6 1.6 7 5" /></svg>
);

const COPY: Record<AuthMode, { title: string; description: string; action: string }> = {
  login: { title: "Masuk ke My Room", description: "Senang ketemu lo lagi.", action: "Masuk" },
  register: { title: "Bikin akun My Room", description: "Mulai dari ruang yang sama.", action: "Daftar" },
  forgot: { title: "Lupa password?", description: "Masukkan email akun lo.", action: "Kirim tautan reset" },
};

function AuthCard({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setStatus("");
    setPassword("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("Memproses…");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setStatus(error.message);
          return;
        }
        setStatus("Berhasil masuk. Membuka My Room…");
        await navigate({ to: "/dashboard", replace: true });
        return;
      }

      if (mode === "register") {
        if (fullName.trim().length < 3) {
          setStatus("Nama lengkap minimal 3 karakter.");
          return;
        }
        if (password.length < 6) {
          setStatus("Password minimal 6 karakter.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) {
          setStatus(error.message);
          return;
        }
        if (data.session) {
          setStatus("Akun dibuat. Membuka My Room…");
          await navigate({ to: "/dashboard", replace: true });
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setStatus("Akun dibuat. Cek email lo buat konfirmasi, lalu masuk.");
          switchMode("login");
          return;
        }
        await navigate({ to: "/dashboard", replace: true });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus("Kalau email lo terdaftar, tautan reset sudah dikirim.");
    } catch {
      setStatus("Ada gangguan koneksi. Coba lagi sebentar lagi.");
    } finally {
      setBusy(false);
    }
  }

  const copy = COPY[mode];

  return (
    <>
      <Button type="button" variant="ghost" className="mr-back" onClick={onBack}>← Kembali</Button>
      <section className="mr-account-area" aria-labelledby="mr-auth-title">
        <div className="mr-card">
          <div className="mr-card-logo logo-slot"><img src={logoAsset.url} alt="Logo My Room" /></div>
          <div className="mr-form-heading">
            <span className="mr-eyebrow">RUANG LO, MULAI DI SINI</span>
            <h1 id="mr-auth-title">{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          <form className="mr-form" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label className="mr-field" htmlFor="my-room-name">
                Nama lengkap
                <span className="mr-field-shell">
                  {USER_ICON}
                  <input id="my-room-name" type="text" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama lengkap lo" disabled={busy} />
                </span>
              </label>
            ) : null}
            <label className="mr-field" htmlFor="my-room-email">
              Email
              <span className="mr-field-shell">
                {MAIL_ICON}
                <input id="my-room-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" disabled={busy} />
              </span>
            </label>
            {mode !== "forgot" ? (
              <label className="mr-field" htmlFor="my-room-password">
                Password
                <span className="mr-field-shell">
                  {LOCK_ICON}
                  <input id="my-room-password" className="mr-password-input" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" disabled={busy} />
                  <Button type="button" variant="ghost" size="icon" className="mr-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </span>
              </label>
            ) : null}
            {mode === "login" ? (
              <div className="mr-forgot-row">
                <button type="button" className="mr-link" onClick={() => switchMode("forgot")}>Lupa password?</button>
              </div>
            ) : null}
            {status ? <p className="mr-status status" role="status">{status}</p> : null}
            <Button type="submit" className="mr-submit" disabled={busy}>
              <span>{busy ? "Memproses…" : copy.action}</span><ArrowRight aria-hidden="true" />
            </Button>
          </form>
          <div className="mr-signup-row">
            {mode === "login" ? (
              <>
                <span>Belum punya akun?</span>
                <button type="button" className="mr-link" onClick={() => switchMode("register")}>Daftar</button>
              </>
            ) : (
              <>
                <span>Sudah punya akun?</span>
                <button type="button" className="mr-link" onClick={() => switchMode("login")}>Masuk</button>
              </>
            )}
          </div>
          <p className="mr-privacy-note">Dengan masuk, lo menyetujui ruang kolaborasi yang aman dan saling menghargai.</p>
        </div>
      </section>
    </>
  );
}

export function MyRoomAuth({ view = "login" }: { view?: "intro" | "login" }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MyRoomEngineHandle | null>(null);
  const [theme, setTheme] = useState<MyRoomTheme>("dark");
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"intro" | "form">("intro");
  const initialPhaseRef = useRef<"intro" | "form">("intro");
  const transitioningRef = useRef(false);

  useEffect(() => {
    const initialTheme = readInitialTheme();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    document.documentElement.style.colorScheme = initialTheme;
    setTheme(initialTheme);
    setPaused(reducedMotion);
    if (view === "login" && window.sessionStorage.getItem(SKIP_INTRO_KEY) === "1") {
      window.sessionStorage.removeItem(SKIP_INTRO_KEY);
      initialPhaseRef.current = "form";
      setPhase("form");
    }
    setReady(true);
    return () => setReady(false);
  }, [view]);

  useEffect(() => {
    if (!ready || !rootRef.current || engineRef.current) return;
    const engine = createMyRoomEngine(rootRef.current, {
      logoUrls: [logoRkModel.url, logoUiModel.url],
      theme,
      paused,
      view: initialPhaseRef.current === "form" ? "login" : "intro",
    });
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      transitioningRef.current = false;
      engine.destroy();
    };
  }, [ready]);

  useEffect(() => { engineRef.current?.setPaused(paused); }, [paused]);
  useEffect(() => { engineRef.current?.setTheme(theme); }, [theme]);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      return next;
    });
  }

  const openForm = useCallback(() => {
    if (transitioningRef.current || phase === "form") return;
    if (view === "intro") {
      window.sessionStorage.setItem(SKIP_INTRO_KEY, "1");
      void navigate({ to: "/login" });
      return;
    }
    transitioningRef.current = true;
    const engine = engineRef.current;
    if (!engine || paused) {
      transitioningRef.current = false;
      setPhase("form");
      return;
    }
    engine.transitionToLogin(() => {
      transitioningRef.current = false;
      setPhase("form");
    });
  }, [navigate, paused, phase, view]);

  const closeForm = useCallback(() => {
    if (transitioningRef.current || phase === "intro") return;
    setPhase("intro");
    transitioningRef.current = true;
    const engine = engineRef.current;
    if (!engine) {
      transitioningRef.current = false;
      return;
    }
    engine.exitLogin(() => {
      transitioningRef.current = false;
    });
  }, [phase]);

  useEffect(() => {
    if (view !== "login") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeForm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeForm, view]);

  const showIntro = view === "intro" || phase === "intro";

  if (!ready) return null;
  return (
    <div ref={rootRef} className="my-room" data-theme={theme}>
      <main className={`mr-stage ${showIntro ? "mr-landing-view" : "mr-login-view"}`} data-my-room-stage aria-label="My Room">
        <div className="mr-aura" aria-hidden="true" />
        <div className="mr-horizon" aria-hidden="true" />
        <canvas className="mr-ambient" data-ambient-canvas aria-hidden="true" />
        <div className="mr-vignette" aria-hidden="true" />
        <MyRoomHeader paused={paused} theme={theme} onPause={() => setPaused((value) => !value)} onTheme={toggleTheme} />
        <canvas className="mr-logos" data-logo-canvas role="img" aria-label="Logo RK dan Universitas Indonesia dalam tampilan 3D" />
        <canvas className="mr-particles" data-particle-canvas aria-hidden="true" />
        <LogoFallback />
        {showIntro ? (
          <>
            <div className="mr-intro">
              <span className="mr-eyebrow">Selamat datang di My Room</span>
              <h1>Dua identitas. Satu ruang bersama.</h1>
              <p>Tempat terhubung, tempat bertumbuh.</p>
            </div>
            <div className="mr-intro-footer">
              <Button type="button" className="mr-enter" onClick={openForm}><span>Klik di mana saja untuk masuk</span><i aria-hidden="true">↗</i></Button>
              <p>Geser untuk memutar logo · klik untuk masuk</p>
            </div>
            <button type="button" className="mr-drag-surface" onClick={openForm} aria-label="Masuk ke ruang My Room" />
          </>
        ) : (
          <AuthCard onBack={view === "login" ? closeForm : () => void navigate({ to: "/" })} />
        )}
        <footer className="mr-footer"><span><i />RUANG UNTUK BERTUMBUH</span><span>DUA IDENTITAS · SATU TUJUAN</span></footer>
      </main>
    </div>
  );
}

export default MyRoomAuth;
