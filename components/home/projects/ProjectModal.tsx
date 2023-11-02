import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { AiFillGithub, AiOutlineExport } from 'react-icons/ai'
import { MdClose } from 'react-icons/md'

interface Props {
  isOpen: boolean
  setIsOpen: Function
  title: string
  imgSrc: string
  code: string
  projectLink: string
  tech: string[]
  modalContent: JSX.Element
}

export const ProjectModal = ({
  modalContent,
  projectLink,
  setIsOpen,
  imgSrc,
  isOpen,
  title,
  code,
  tech,
}: Props) => {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const body = document.querySelector('body')

    if (isOpen) {
      body!.style.overflowY = 'hidden'
    } else {
      body!.style.overflowY = 'scroll'
    }
  }, [isOpen])

  useEffect(() => {
    if (isClosing) {
      setTimeout(() => {
        setIsOpen(false)
        setIsClosing(false)
      }, 300)
    }
  }, [isClosing, setIsOpen])

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={isClosing ? { opacity: 0 } : { opacity: 1 }}
      className={
        'fixed inset-0 z-50 h-screen p-4 md:p-16 bg-bg-opaque backdrop-blur-lg overflow-y-scroll flex justify-center cursor-pointer'
      }
      onClick={() => setIsClosing(true)}>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={isClosing ? { y: '80vh', opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, mass: 0.75 }}
        onClick={(e) => e.stopPropagation()}
        className={
          'w-full max-w-2xl h-fit rounded-2xl overflow-hidden bg-background-light shadow-lg cursor-auto relative'
        }>
        <button
          onClick={() => setIsClosing(true)}
          className={
            'bg-bg-opaque rounded-md absolute text-4xl top-4 right-4 cursor-pointer transition-all transform hover:rotate-6 hover:bg-brand hover:text-6xl'
          }>
          <MdClose />
        </button>

        {/* <img
          className={styles.modalImage}
          src={imgSrc}
          alt={`An image of the ${title} project.`}
        /> */}

        <Image
          src={imgSrc}
          alt={`An image of the ${title} project.`}
          width={10000}
          height={10000}
          className="w-full"
        />
        <div className={'p-6'}>
          <h4 className="text-4xl font-semibold">{title}</h4>
          <div
            className={
              'flex flex-wrap gap-4 text-brand font-semibold text-lg mt-2 mb-6'
            }>
            {tech.join(' - ')}
          </div>

          <div className={'flex flex-col prose prose-invert'}>
            {modalContent}
          </div>

          <div className="w-full h-1 rounded-full opacity-50 bg-text mt-6"></div>

          {(code != '' || projectLink != '') && (
            <div className={'mt-2'}>
              <p className={'text-2xl font-semibold'}>
                Project Links<span className="text-brand">.</span>
              </p>
              <div className={'flex items-center gap-4 text-lg text-brand'}>
                {code != '' && (
                  <Link
                    target="_blank"
                    rel="nofollow"
                    href={code}
                    className="flex items-center gap-2 hover:underline">
                    <AiFillGithub /> source code
                  </Link>
                )}
                {projectLink != '' && (
                  <Link
                    target="_blank"
                    rel="nofollow"
                    href={projectLink}
                    className="flex items-center gap-2 hover:underline">
                    <AiOutlineExport /> live project
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )

  if (!isOpen) return <></>

  // @ts-ignore
  return ReactDOM.createPortal(content, document.getElementById('root'))
}
