import { createFileRoute } from "@tanstack/react-router";
import { MyRoomAuth } from "@/components/MyRoomAuth";
import myRoomLogo from "@/assets/Logo_aplikasi_MR.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk — My Room" },
      {
        name: "description",
        content: "Masuk ke My Room, ruang bersama untuk terhubung dan bertumbuh.",
      },
      { property: "og:title", content: "Masuk — My Room" },
      {
        property: "og:description",
        content: "Masuk ke My Room, ruang bersama untuk terhubung dan bertumbuh.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" },
      { rel: "preload", as: "image", href: myRoomLogo.url },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <MyRoomAuth />;
}
