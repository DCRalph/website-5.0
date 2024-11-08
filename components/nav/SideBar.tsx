import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export const SideBar = () => {
  const [selected, setSelected] = useState('')

  useEffect(() => {
    const sections = document.querySelectorAll('.section-wrapper')

    const options = {
      threshold: 0.5,
    }

    const callback = (entries: any) => {
      entries.forEach((entry: any) => {
        if (entry.isIntersecting) {
          setSelected(entry.target.id)
          // console.log(entry.target.id)
        }
      })
    }

    const observer = new IntersectionObserver(callback, options)

    sections.forEach((section) => observer.observe(section))
  }, [])

  return (
    <motion.nav
      initial={{ x: -70 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5 }}
      className={"sideBar"}>
      <motion.a
        initial={{ x: -70 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        href="#"
        onClick={() => {
          setSelected('hero')
        }}
        className={"sideBarItem !h-20 !opacity-100 " + (selected === 'hero' ? "selected" : '')}>
        <span className='logo'>
          W<span className={"text-brand"}>.</span>
        </span>
      </motion.a>
      <motion.a
        initial={{ x: -70 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        href="#about"
        onClick={() => {
          setSelected('about')
        }}
        className={"sideBarItem " + (selected === 'about' ? "selected" : '')}>
        About
      </motion.a>
      <motion.a
        initial={{ x: -70 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        href="#projects"
        onClick={() => setSelected('projects')}
        className={"sideBarItem " + (selected === 'projects' ? "selected" : '')}>
        Projects
      </motion.a>
      <motion.a
        initial={{ x: -70 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        href="#experience"
        onClick={() => setSelected('experience')}
        className={"sideBarItem " + (selected === 'experience' ? "selected" : '')}>
        Exp.
      </motion.a>
      <motion.a
        initial={{ x: -70 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        href="#contact"
        onClick={() => setSelected('contact')}
        className={"sideBarItem " + (selected === 'contact' ? "selected" : '')}>
        Contact
      </motion.a>
    </motion.nav>
  )
}
