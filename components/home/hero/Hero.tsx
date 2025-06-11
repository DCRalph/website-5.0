import { StandardButton } from '@/components/buttons/StandardButton'
import { Reveal } from '@/components/utils/Reveal'
import { DotGrid } from './DotGrid'

export const Hero = () => {
  return (
    <section className={`section-wrapper pb-20 overflow-hidden`} id="hero">
      <div className={'relative z-10 w-fit mt-4 mb-8 lg:mb-20'}>
        <Reveal>
          <h1 className={'font-extrabold !leading-normal text-4xl md:text-5xl lg:text-7xl '}>
            Hey, I&apos;m William<span className="text-brand">.</span>
          </h1>
        </Reveal>
        <Reveal>
          <h2 className={"text-4xl my-4 font-light"}>
            I&apos;m a <span className='text-brand font-bold'>Developer</span>
          </h2>
        </Reveal>
        <Reveal>
          <p className={'max-w-xl text-lg backdrop-blur rounded-lg'}>
            I&apos;ve spent the last 10 years learning and tinkering with
            different technologies. That has led me to where I am today,
            studying a Software Engineering degree at Yoobee Colleage.
          </p>
        </Reveal>
          <div className='mt-8'></div>
        <Reveal>
          <StandardButton 
            onClick={() =>
              document.getElementById('contact')?.scrollIntoView()
            }>
            Contact me
          </StandardButton>
        </Reveal>
      </div>
      <DotGrid />
    </section>
  )
}
