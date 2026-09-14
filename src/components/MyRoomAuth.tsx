import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase-external";
import shellHtml from "./my-room/shell.html?raw";
import myRoomCss from "./MyRoomAuth.css?raw";
import { createMyRoom, type MyRoomHandle, type MyRoomSubmit } from "./my-room/engine";
import myRoomLogo from "@/assets/Logo_aplikasi_MR.png.asset.json";

const brandedShellHtml = shellHtml.replaceAll("__MY_ROOM_LOGO__", myRoomLogo.url);

/**
 * My Room login experience: full-screen intro, interactive 3D logos, particle
 * transition into the auth card. Auth uses the app's existing Supabase client
 * and the existing routes (/dashboard, /reset-password).
 */
export function MyRoomAuth() {
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MyRoomHandle | null>(null);
  const submittingRef = useRef(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    async function handleSubmit(payload: MyRoomSubmit) {
      const api = handleRef.current;
      if (!api || submittingRef.current) return;
      const email = payload.email.trim();

      submittingRef.current = true;
      api.setBusy(true);
      api.setStatus("Memproses…");

      try {
        if (payload.mode === "reset") {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          api.setStatus(error ? error.message : "Tautan reset sudah dikirim. Cek inbox email lo.");
          return;
        }

        if (payload.mode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email,
            password: payload.password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { full_name: payload.name.trim() },
            },
          });
          if (error) {
            api.setStatus(error.message);
            return;
          }
          if (!data.session) {
            api.setStatus("Akun dibuat. Cek email lo untuk konfirmasi sebelum masuk.");
            return;
          }
          api.setStatus("Akun siap. Membuka My Room…");
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: payload.password,
        });
        if (error) {
          api.setStatus(error.message);
          return;
        }
        api.setStatus("Berhasil masuk. Membuka My Room…");
        navigate({ to: "/dashboard", replace: true });
      } catch {
        api.setStatus("Ada gangguan koneksi. Coba lagi sebentar lagi.");
      } finally {
        submittingRef.current = false;
        handleRef.current?.setBusy(false);
      }
    }

    const api = createMyRoom(host, { onSubmit: (payload) => void handleSubmit(payload) });
    handleRef.current = api;

    return () => {
      handleRef.current = null;
      api.destroy();
    };
  }, [navigate]);

  return (
    <>
      {/* Scoped to this page only: the styles unmount with the login route. */}
      <style dangerouslySetInnerHTML={{ __html: myRoomCss }} />
      <div ref={hostRef} dangerouslySetInnerHTML={{ __html: brandedShellHtml }} />
    </>
  );
}

export default MyRoomAuth;
