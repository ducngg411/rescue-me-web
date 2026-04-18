import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { GuestProvider } from "@/contexts/GuestContext";
import { Toaster } from "react-hot-toast";
import ChatbotWidget from "@/components/ChatbotWidget";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,   // Prevents iOS Safari auto-zoom when focusing inputs
  userScalable: false,
  themeColor: "#f97316",
};

export const metadata: Metadata = {
  title: "Rescue Me - Dịch vụ Cứu hộ",
  description: "Nền tảng cứu hộ khẩn cấp kết nối tài xế với nhà cứu hộ gần nhất",
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${lexend.variable} antialiased`}
      >
        <LanguageProvider>
          <AuthProvider>
            <GuestProvider>
              {children}
              <ChatbotWidget />
            </GuestProvider>
          </AuthProvider>
        </LanguageProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
