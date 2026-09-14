import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MyRoomAuth } from "@/components/MyRoomAuth";
import { supabase } from "@/lib/supabase-external";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Room — Ruang Kolaborasi Organisasi" },
      {
        name: "description",
        content: "Masuk ke My Room untuk mengelola pekerjaan dan aktivitas organisasi.",
      },
      { property: "og:title", content: "My Room — Ruang Kolaborasi Organisasi" },
      {
        property: "og:description",
        content: "Masuk ke My Room untuk mengelola pekerjaan dan aktivitas organisasi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  component: OpeningPage,
});

function OpeningPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) void navigate({ to: "/dashboard", replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  return <MyRoomAuth view="intro" />;
}
