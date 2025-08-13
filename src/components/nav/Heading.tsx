"use client";

import { MyLinks } from './MyLinks'
import { OutlineButton } from '../buttons/OutlineButton'
import { motion } from 'motion/react';

export const Heading = () => {
  return (
    <header className={"h-20 px-10 md:px-14 flex items-center justify-between sticky top-0 z-20 bg-background/25 backdrop-blur-lg text-text-md font-bold"} id="header">
      <MyLinks />
      <motion.span
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <OutlineButton onClick={() => window.open('/cv.pdf')}>
          My resume
        </OutlineButton>
      </motion.span>

    </header>
  )
}
