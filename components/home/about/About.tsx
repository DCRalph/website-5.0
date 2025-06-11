import { MyLinks } from '@/components/nav/components/MyLinks'
import { Reveal } from '@/components/utils/Reveal'
import { SectionHeader } from '@/components/utils/SectionHeader'
import { Stats } from './Stats'
import { AiOutlineArrowRight } from 'react-icons/ai'

export const About = () => {
  return (
    <section id="about" className="section-wrapper relative ">
      <SectionHeader title="About" dir="l" />
      <div className={"grid gap-5 grid-cols-1 lg:grid-cols-[1fr,18rem]"}>
        <div className='text-lg'>
          <Reveal>
            <p className={"font-lg mb-6"}>
              Hey! I&apos;m William, if you haven&apos;t already gathered that
              by now. I&apos;m a software engineer from Wellington, New Zealand.
            </p>
          </Reveal>
          <Reveal>
            <p className={"font-light mb-6"}>
              Solving complex problems and bringing ideas to life through
              software excites me. Whether it&apos;s creating algorithms,
              designing user-friendly interfaces, or exploring the backend of
              systems.
            </p>
          </Reveal>

          <Reveal>
            <p className={"font-light mb-6"}>
              I am currently studying a Software Engineering degree at Yoobee
              Colleage.
            </p>
          </Reveal>
          <Reveal>
            <p className={"font-light mb-6"}>
              I currently work for Bactosure as a Software Engineer, building
              software for testing water for bacteria.
            </p>
          </Reveal>
          <Reveal>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 text-brand text-xl">
                <span>My links</span>
                <AiOutlineArrowRight />
              </div>
              <MyLinks />
            </div>
          </Reveal>
        </div>
        <Stats />
      </div>
    </section>
  )
}
