import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { FontProvider } from "./context/FontContext";

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
