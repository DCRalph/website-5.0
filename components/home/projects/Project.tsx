import { Reveal } from "@/components/utils/Reveal";
import { useAnimation, useInView, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { use, useEffect, useRef, useState } from "react";
import { AiFillGithub, AiOutlineExport } from "react-icons/ai";
import { ProjectModal } from "./ProjectModal";

import { ProjectMDX } from "contentlayer/generated";

interface ProjectProps {
  project: ProjectMDX;
  shouldOpen: boolean;
}

export const Project = ({ project, shouldOpen }: ProjectProps) => {
  const [hovered, setHovered] = useState(false);

  const [isOpen, setIsOpen] = useState(false);

  const controls = useAnimation();

  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    } else {
      controls.start("hidden");
    }
  }, [isInView, controls]);

  useEffect(() => {
    if (shouldOpen) {
      setIsOpen(true);
    }
  }, [shouldOpen]);

  return (
    <>
      <motion.div
        ref={ref}
        variants={{
          hidden: { opacity: 0, y: 100 },
          visible: { opacity: 1, y: 0 },
        }}
        initial="hidden"
        animate={controls}
        transition={{ duration: 0.75 }}
      >
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => setIsOpen(true)}
          className={
            "relative aspect-video w-full cursor-pointer overflow-hidden rounded-lg bg-background-light"
          }
        >
          <Image
            src={project.coverImage}
            alt={`An image of the ${project.title} project.`}
            width={10000}
            height={10000}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-5 rounded-t-lg transition-all"
            style={{
              width: hovered ? "95%" : "90%",
              rotate: hovered ? "2deg" : "0deg",
            }}
          />
        </div>
        <div className={"my-4"}>
          <Reveal width="100%">
            <div className={"flex items-center gap-4"}>
              <h4 className="max-w-[calc(100%-120px)] shrink-0 text-lg font-bold xl:text-2xl">
                {project.title}
              </h4>
              <div className={"h-1 w-full rounded-full bg-text opacity-30"} />

              {project.codeLink != undefined && (
                <Link
                  href={project.codeLink}
                  target="_blank"
                  rel="nofollow"
                  className="transition-all hover:text-brand"
                >
                  <AiFillGithub size="2rem" />
                </Link>
              )}

              {project.projectLink != undefined && (
                <Link
                  href={project.projectLink}
                  target="_blank"
                  rel="nofollow"
                  className="transition-all hover:text-brand"
                >
                  <AiOutlineExport size="2rem" />
                </Link>
              )}
            </div>
          </Reveal>
          <Reveal>
            <div
              className={"my-2 flex flex-wrap gap-2 font-semibold text-brand"}
            >
              {project.techArr.join(" - ")}
            </div>
          </Reveal>
          <Reveal>
            <p className={"text-lg"}>
              {project.description}{" "}
              <span
                onClick={() => setIsOpen(true)}
                className=" cursor-pointer font-semibold text-brand hover:underline"
              >
                Learn more {">"}
              </span>
            </p>
          </Reveal>
        </div>
      </motion.div>
      <ProjectModal project={project} isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
};
