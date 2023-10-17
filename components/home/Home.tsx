import React from 'react'
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
      <div className="grid grid-cols-[60px,1fr] bg-gradient-to-b  from-[var(--background)] from-80% to-[var(--background-dark)]">
        <SideBar />
        <main className=''>
          <Heading />
          <Hero />
          <About />
          <Projects />
          <Experience />
          <Contact />
          <div className='w-full h-48'></div>
          {/* <div className="h-[200px] bg-gradient-to-b from-[var(--background)] to-[var(--background-dark)]" /> */}
        </main>
      </div>
    </>
  )
}
