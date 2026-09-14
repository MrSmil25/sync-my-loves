import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Moon, Pause, Play, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/Logo_aplikasi_MR.png.asset.json";
import { supabase } from "@/lib/supabase-external";
import {
  createMyRoomEngine,
  type MyRoomEngineHandle,
  type MyRoomTheme,
} from "./my-room/engine";
import "./MyRoomAuth.css";

const THEME_KEY = "my-room-theme";

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

function LoginCard({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("Memproses…");
    try {
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
    } catch {
      setStatus("Ada gangguan koneksi. Coba lagi sebentar lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" className="mr-back" onClick={onBack}>← Kembali</Button>
      <section className="mr-account-area" aria-labelledby="login-title">
        <div className="mr-card">
          <div className="mr-card-logo"><img src={logoAsset.url} alt="Logo My Room" /></div>
          <div className="mr-form-heading">
            <span className="mr-eyebrow">RUANG LO, MULAI DI SINI</span>
            <h1 id="login-title">Masuk ke My Room</h1>
            <p>Senang ketemu lo lagi.</p>
          </div>
          <form className="mr-form" onSubmit={handleSubmit}>
            <label className="mr-field" htmlFor="my-room-email">
              Email
              <span className="mr-field-shell">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" aria-hidden="true"><path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6" /></svg>
                <input id="my-room-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" disabled={busy} />
              </span>
            </label>
            <label className="mr-field" htmlFor="my-room-password">
              Password
              <span className="mr-field-shell">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                <input id="my-room-password" className="mr-password-input" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" disabled={busy} />
                <Button type="button" variant="ghost" size="icon" className="mr-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </span>
            </label>
            <div className="mr-forgot-row"><Link to="/forgot-password">Lupa password?</Link></div>
            {status ? <p className="mr-status" role="status">{status}</p> : null}
            <Button type="submit" className="mr-submit" disabled={busy}>
              <span>{busy ? "Memproses…" : "Masuk"}</span><ArrowRight aria-hidden="true" />
            </Button>
          </form>
          <div className="mr-signup-row"><span>Belum punya akun?</span><Link to="/register">Daftar</Link></div>
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
  const transitioningRef = useRef(false);

  useEffect(() => {
    const initialTheme = readInitialTheme();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    document.documentElement.style.colorScheme = initialTheme;
    setTheme(initialTheme);
    setPaused(reducedMotion);
    setReady(true);
    return () => setReady(false);
  }, []);

  useEffect(() => {
    if (!ready || !rootRef.current || engineRef.current) return;
    const engine = createMyRoomEngine(rootRef.current, {
      logoUrl: logoAsset.url,
      theme,
      paused,
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

  function enterLogin() {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    const engine = engineRef.current;
    if (!engine || paused) {
      void navigate({ to: "/login" });
      return;
    }
    engine.transitionToLogin(() => void navigate({ to: "/login" }));
  }

  if (!ready) return null;
  return (
    <div ref={rootRef} className="my-room" data-theme={theme}>
      <main className={`mr-stage ${view === "login" ? "mr-login-view" : "mr-landing-view"}`} data-my-room-stage aria-label="My Room">
        <div className="mr-aura" aria-hidden="true" />
        <div className="mr-horizon" aria-hidden="true" />
        <canvas className="mr-ambient" data-ambient-canvas aria-hidden="true" />
        <div className="mr-vignette" aria-hidden="true" />
        <MyRoomHeader paused={paused} theme={theme} onPause={() => setPaused((value) => !value)} onTheme={toggleTheme} />
        <canvas className="mr-logos" data-logo-canvas role="img" aria-label="Logo My Room dan simbol M dalam tampilan 3D" />
        <canvas className="mr-particles" data-particle-canvas aria-hidden="true" />
        <LogoFallback />
        {view === "intro" ? (
          <>
            <div className="mr-intro"><span className="mr-eyebrow">Selamat datang di My Room</span><h1>Dua identitas. Satu ruang bersama.</h1><p>Tempat terhubung, tempat bertumbuh.</p></div>
            <div className="mr-intro-footer">
              <Button type="button" className="mr-enter" onClick={enterLogin}><span>Masuk ke ruang</span><i aria-hidden="true">↗</i></Button>
              <p>Geser untuk memutar logo · klik untuk masuk</p>
            </div>
            <button type="button" className="mr-drag-surface" onClick={enterLogin} aria-label="Masuk ke ruang My Room" />
          </>
        ) : <LoginCard onBack={() => void navigate({ to: "/" })} />}
        <footer className="mr-footer"><span><i />RUANG UNTUK BERTUMBUH</span><span>DUA IDENTITAS · SATU TUJUAN</span></footer>
      </main>
    </div>
  );
}

export default MyRoomAuth;
