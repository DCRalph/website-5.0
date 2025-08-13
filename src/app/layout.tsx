import "~/styles/globals.css";

import { Poppins } from "next/font/google";
import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/next";

// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-sans",
// });

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['100', '200', '400', '700', '900'],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Modern WikiClone",
  description: "A modern WikiClone built with Next.js and shadcn/ui",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* <body className={`font-sans ${inter.variable}`}> */}
      <body className={`${poppins.className}`}>
        {process.env.NODE_ENV === 'production' && (
          <Analytics
            endpoint="/fuckoffaddblockers"
            scriptSrc="/fuckoffaddblocker/script.js"
          />
        )}

        {children}

      </body>
    </html>
  );
}
