
import React, { Suspense } from 'react'
import { SideBar } from '../nav/SideBar'
import { Hero } from './hero/Hero'
import { Heading } from '../nav/Heading'
import { About } from './about/About'
import { Projects } from './projects/Projects'
import { Experience } from './experience/Experience'
import { Contact } from './contact/Contact'

export const Home = () => {
  return (
    <>
      <div className="grid grid-cols-[60px_1fr] bg-linear-to-b  from-(--background) from-80% to-(--background-dark)">
        <SideBar />
        <main>
          <Heading />
          <Hero />
          <About />
          <Suspense fallback={null}>
            <Projects />
          </Suspense>
          <Experience />
          <Contact />
          <div className='w-full h-64'></div>
          {/* <div className="h-[200px] bg-linear-to-b from-(--background) to-(--background-dark)" /> */}
        </main>
      </div>
    </>
  )
}
