
import {
  AiFillLinkedin,
  AiFillGithub,
  AiFillTwitterCircle,
  AiFillCodepenCircle,
} from "react-icons/ai";
import Link from "next/link";
import { motion } from "framer-motion";
import { me } from '@/lib/me'

export const MyLinks = () => {
  return (
    <div className={"flex gap-6 items-center h-full"}>
      <motion.span
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Link href={me.linkedin} target="_blank" rel="nofollow" className="opacity-50 relative z-20 hover:opacity-100 transition-all hover:text-brand">
          <AiFillLinkedin size="2rem" />
        </Link>
      </motion.span>

      <motion.span
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2}}
      >
        <Link href={me.github} target="_blank" rel="nofollow" className="opacity-50 relative z-20 hover:opacity-100 transition-all hover:text-brand">
          <AiFillGithub size="2rem" />
        </Link>
      </motion.span>

    </div>
  );
};
