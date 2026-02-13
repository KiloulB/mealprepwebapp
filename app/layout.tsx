import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { FontProvider } from "./context/FontContext";
import NoZoom from "./NoZoom";
import BottomNav from "./components/BottomNav/BottomNav";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Meal Prep App",
  description: "Web version of the meal prep app",
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
