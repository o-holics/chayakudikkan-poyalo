import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Malayalam } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const malayalam = Noto_Sans_Malayalam({
  subsets: ["malayalam"],
  weight: ["400", "600"],
  variable: "--font-mal",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://chayakudikanpooyalo.in"),
  title: {
    default: "chayakudikanpooyalo",
    template: "%s · chayakudikanpooyalo",
  },
  description: "A quiet way for late-night chai lovers to share a table.",
  applicationName: "chayakudikanpooyalo",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "chaya" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
  ],
};

// Apply the stored theme before first paint to avoid a flash.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('chaya-theme');if(t==='night'||t==='day'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${malayalam.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full bg-paper text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
