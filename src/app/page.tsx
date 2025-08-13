import React from "react";
import { Home } from "../components/home/Home";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "William Giles | Developer",
  description: "Developer and cool guy.",
  openGraph: {
    title: "William Giles | Developer",
    description: "Developer and cool guy.",
    type: "website",
    url: "https://w-g.co/",
    images: ["/logo.png"],
  },
};

export default function Page() {
  return (
    <>
      <Home />
      <SpeedInsights />
    </>
  );
}


