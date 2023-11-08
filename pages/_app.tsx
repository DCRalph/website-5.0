import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Poppins } from 'next/font/google'
import { Analytics } from "@vercel/analytics/react";


const poppins = Poppins({
  subsets: ['latin'],
  weight: ['100', '200', '400', '700', '900'],
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div id="root" className={poppins.className}>
      <Component {...pageProps} />
      <Analytics />
    </div>
  )
}
