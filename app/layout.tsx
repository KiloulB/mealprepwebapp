import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { FontProvider } from "./context/FontContext";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "Peak",
  description: "Eat. Train. Peak.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Peak",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <UserProvider>
          <FontProvider>
            {children}
          </FontProvider>
        </UserProvider>
        
      </body>
    </html>
  );
}
