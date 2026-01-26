import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { FontProvider } from "./context/FontContext";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

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
        className={`${inter.variable} antialiased`}
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
