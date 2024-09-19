import Head from "next/head";
import { Home } from "@/components/home/Home";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function home() {


  return (
    <>
      <Head>
        <title>William Giles | Developer</title>
        <meta name="description" content="Developer and cool guy." />

        {/* <!-- Google / Search Engine Tags --> */}
        <meta itemProp="name" content="William Giles | Developer" />
        <meta itemProp="description" content="Developer and cool guy." />
        <meta itemProp="image" content="/logo.png" />

        {/* <!-- Facebook Meta Tags --> */}
        <meta property="og:url" content="https://w-g.co/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="William Giles | Developer" />
        <meta property="og:description" content="Developer and cool guy." />
        <meta property="og:image" content="/logo.png" />

        {/* <!-- Twitter Meta Tags --> */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="William Giles | Developer" />
        <meta name="twitter:description" content="Developer and cool guy." />
        <meta name="twitter:image" content="/logo.png" />

        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Home />
      <SpeedInsights />
    </>
  );
}
