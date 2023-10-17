import { Reveal } from '@/components/utils/Reveal'
import { AiFillMail } from 'react-icons/ai'
import Link from 'next/link'

import { me } from '@/lib/me'

export const Contact = () => {
  return (
    <section className="section-wrapper" id="contact">
      <Reveal width="100%">
        <h4
          className={'text-center font-bold text-4xl md:text-6xl lg:text-8xl'}>
          Contact<span className="text-brand">.</span>
        </h4>
      </Reveal>
      <Reveal width="100%">
        <p className={'text-center text-base md:text-lg my-6'}>
          Shoot me an email if you want to connect!
        </p>
      </Reveal>
      <Reveal width="100%">
        <Link href={'mailto:' + me.email}>
          <div
            className={
              'flex items-center justify-center gap-4 text-base md:text-xl transition-all hover:text-brand'
            }>
            <AiFillMail size="2.4rem" />
            {me.email}
          </div>
        </Link>
      </Reveal>
    </section>
  )
}
