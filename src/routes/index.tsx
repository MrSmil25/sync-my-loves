import { createFileRoute, redirect } from "@tanstack/react-router";

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
  }),
  beforeLoad: async () => {
    const { supabase } = await import("@/lib/supabase-external");
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/login", replace: true });
  },
  component: () => null,
});
