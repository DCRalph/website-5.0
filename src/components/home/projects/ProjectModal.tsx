"use client"

import { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { AiFillGithub, AiOutlineExport } from "react-icons/ai"
import { MdClose } from "react-icons/md"

import DateText from "~/components/utils/DateText"
import { MDXProvider } from "@mdx-js/react"
import { useMDXComponents } from "~/components/utils/MDX"
import type { ProjectDoc } from "./Project"
import { ArrowUpRight } from "lucide-react"

interface Props {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  project: ProjectDoc
}

export const ProjectModal = ({ project, isOpen, setIsOpen }: Props) => {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const body = document.querySelector("body")

    if (isOpen) {
      body!.style.overflowY = "hidden"
    } else {
      body!.style.overflowY = "scroll"
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
        "fixed inset-0 z-50 flex h-screen cursor-pointer justify-center overflow-y-scroll bg-background-dark/80 p-4 backdrop-blur-xl md:p-16"
      }
      onClick={() => setIsClosing(true)}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={isClosing ? { y: "80vh", opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 12, mass: 0.75 }}
        onClick={(e) => e.stopPropagation()}
        className={
          "relative h-fit w-full max-w-2xl mt-4 cursor-auto overflow-hidden rounded-3xl bg-background shadow-2xl border border-white/10"
        }
      >
        {/* Enhanced close button with better contrast and hover states */}
        <button
          onClick={() => setIsClosing(true)}
          className={
            "absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all duration-200 hover:bg-brand hover:text-background hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand"
          }
        >
          <MdClose className="text-xl" />
        </button>

        {/* Image with subtle overlay for better text contrast */}
        <div className="relative">
          <Image
            src={project.coverImage || "/placeholder.svg"}
            alt={`An image of the ${project.title} project.`}
            width={10000}
            height={10000}
            className="w-full h-64 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>

        <div className={"p-8 space-y-6"}>
          {/* Enhanced title with better typography */}
          <div className="space-y-3">
            <h4 className="text-4xl font-bold text-white leading-tight">{project.title}</h4>

            {/* Enhanced tech stack with colorful badges */}
            <div className="flex flex-wrap gap-2">
              {project.techArr.map((tech, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 text-sm font-medium rounded-full border border-brand/30 bg-gradient-to-r from-brand/20 to-brand/10 text-white/90 hover:from-brand/30 hover:to-brand/20 hover:border-brand/50 transition-all duration-200"
                >
                  {tech}
                </span>
              ))}
            </div>

            {/* Enhanced date with better contrast */}
            <div className="flex items-center gap-2 text-white/70">
              {/* <div className="w-2 h-2 rounded-full bg-brand"></div> */}
              <DateText publishedAt={project.publishedAt} updatedAt={project.updatedAt} />
            </div>
          </div>

          {/* Enhanced content area with better readability */}
          <article className="prose prose-invert prose-neutral max-w-none ">
            <MDXProvider components={useMDXComponents()}>
              <project.Component />
            </MDXProvider>
          </article>

          {/* Enhanced divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border/60 to-transparent"></div>

          {/* Enhanced project links section */}
          {(project.codeLink != undefined || project.projectLink != undefined) && (
            <div className="space-y-4">
              <h5 className="text-2xl font-bold text-white flex items-center gap-2">
                Project Links
                <span className="text-brand">.</span>
              </h5>
              <div className="flex flex-wrap gap-4">
                {project.codeLink != undefined && (
                  <Link
                    target="_blank"
                    rel="nofollow"
                    href={project.codeLink}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-brand/50 bg-white/10 text-white/80 hover:border-brand hover:text-white transition-all duration-200 hover:scale-105"
                  >
                    <AiFillGithub className="text-xl text-white transition-colors group-hover:text-white" />
                    <span className="font-semibold">Source Code</span>
                  </Link>
                )}
                {project.projectLink != undefined && (
                  <Link
                    target="_blank"
                    rel="nofollow"
                    href={project.projectLink}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-brand/50 bg-brand text-white transition-all duration-200 hover:opacity-90 hover:scale-105 shadow-lg"
                  >
                    <ArrowUpRight className="w-5 h-5 mr-1" />
                    <span className="font-semibold">Live Project</span>
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

  return ReactDOM.createPortal(content, document.querySelector("body")!)
}
