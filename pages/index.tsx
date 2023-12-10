import Head from "next/head";
import { Home } from "@/components/home/Home";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function home() {
  return (
    <>
      <Head>
        <title>William Giles | Developer</title>
        <meta name="description" content="Developer and cool guy." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Home />
      <SpeedInsights />
    </>
  );
}
