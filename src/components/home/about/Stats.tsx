"use client";
import { AiFillCode, AiFillSmile } from 'react-icons/ai'
import { Reveal } from '~/components/utils/Reveal'

import { me } from '~/lib/me'


export const Stats = () => {
  return (
    <div className={'relative'}>
      <Reveal>
        <div>
          <h4 className="flex items-center mb-4 text-2xl font-bold gap-4">
            <AiFillSmile size="2rem" color="var(--brand)" />
            <span>Use for fun</span>
          </h4>
          <div className={'flex flex-wrap gap-2 mb-8'}>
            {me.funTech.map((item, i) => (
              <span key={i} className="chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
      <Reveal>
        <div>
          <h4 className="flex items-center mb-4 mt-8 md:mt-0 text-2xl font-bold gap-4">
            <AiFillCode size="2rem" color="var(--brand)" />
            <span>Use at work</span>
          </h4>
          <div className={'flex flex-wrap gap-2 mb-8'}>
            {/* <span className="chip">test</span> */}

            {me.workTech.map((item, i) => (
              <span key={i} className="chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

    </div>
  )
}
