import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { AiFillGithub, AiOutlineExport } from "react-icons/ai";
import { MdClose } from "react-icons/md";

import DateText from "@/components/utils/DateText";

import { ProjectMDX } from "contentlayer/generated";
import { MDX } from "@/components/utils/MDX";

interface Props {
  isOpen: boolean;
  setIsOpen: Function;
  project: ProjectMDX;
}

export const ProjectModal = ({ project, isOpen, setIsOpen }: Props) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const body = document.querySelector("body");

    if (isOpen) {
      body!.style.overflowY = "hidden";
    } else {
      body!.style.overflowY = "scroll";
    }
  }, [isOpen]);

  useEffect(() => {
    if (isClosing) {
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 300);
    }
  }, [isClosing, setIsOpen]);

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={isClosing ? { opacity: 0 } : { opacity: 1 }}
      className={
        "fixed inset-0 z-50 flex h-screen cursor-pointer justify-center overflow-y-scroll bg-bg-opaque p-4 backdrop-blur-lg md:p-16"
      }
      onClick={() => setIsClosing(true)}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={isClosing ? { y: "80vh", opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 12, mass: 0.75 }}
        onClick={(e) => e.stopPropagation()}
        className={
          "relative h-fit w-full max-w-2xl cursor-auto overflow-hidden rounded-2xl bg-background-light shadow-lg"
        }
      >
        <button
          onClick={() => setIsClosing(true)}
          className={
            "absolute right-4 top-4 transform cursor-pointer rounded-md bg-bg-opaque text-4xl transition-all hover:rotate-6 hover:bg-brand hover:text-6xl"
          }
        >
          <MdClose />
        </button>

        {/* <img
          className={styles.modalImage}
          src={imgSrc}
          alt={`An image of the ${title} project.`}
        /> */}

        <Image
          src={project.coverImage}
          alt={`An image of the ${project.title} project.`}
          width={10000}
          height={10000}
          className="w-full"
        />
        <div className={"p-6"}>
          <h4 className="text-4xl font-semibold">{project.title}</h4>
          <div
            className={
              "mb-2 mt-2 flex flex-wrap gap-4 text-lg font-semibold text-brand"
            }
          >
            {project.techArr.join(" - ")}
          </div>

          <div className="mb-6 flex flex-wrap gap-4  text-base text-white">
            <DateText
              publishedAt={project.publishedAt}
              updatedAt={project.updatedAt}
            />
          </div>

          {/* <div className={'flex flex-col prose prose-invert'}>
          </div> */}

          <MDX code={project.body.code} />
          <div className="mt-6 h-1 w-full rounded-full bg-text opacity-50"></div>

          {(project.codeLink != undefined ||
            project.projectLink != undefined) && (
            <div className={"mt-2"}>
              <p className={"text-2xl font-semibold"}>
                Project Links<span className="text-brand">.</span>
              </p>
              <div className={"flex items-center gap-4 text-lg text-brand"}>
                {project.codeLink != undefined && (
                  <Link
                    target="_blank"
                    rel="nofollow"
                    href={project.codeLink}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <AiFillGithub /> source code
                  </Link>
                )}
                {project.projectLink != undefined && (
                  <Link
                    target="_blank"
                    rel="nofollow"
                    href={project.projectLink}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <AiOutlineExport /> live project
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  if (!isOpen) return <></>;

  // @ts-ignore
  return ReactDOM.createPortal(content, document.getElementById("root"));
};
