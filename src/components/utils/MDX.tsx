import Image from "next/image";
import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type LinkProps = PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>;

const linkClass = "underline underline-offset-4 decoration-[#444] transition-colors hover:decoration-brand";

const CustomLink = ({ href = "#", children, ...rest }: LinkProps) => {
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={linkClass} {...rest}>
      {children}
    </Link>
  );
};

/**
 * Images in a writeup double as gallery entries: ProjectDrawer reads these data
 * attributes back out of the rendered article to build the full screen gallery
 * and to open it at the image that was clicked. Outside a drawer it is inert.
 */
const MdxImage = ({ src, alt = "" }: { src?: string; alt?: string }) => {
  if (!src) return null;
  return (
    <button
      type="button"
      data-gallery-src={src}
      data-gallery-alt={alt}
      aria-label={alt ? undefined : "View image full screen"}
      className="block w-full cursor-zoom-in"
    >
      <Image src={src} alt={alt} width={1600} height={1000} className="w-full rounded-lg" />
    </button>
  );
};

const Callout = ({ emoji, children }: PropsWithChildren<{ emoji: string }>) => (
  <div className="my-6 flex gap-4 border-l-2 border-brand pl-4">
    <div>{emoji}</div>
    <div>{children}</div>
  </div>
);

const components: MDXComponents = {
  a: CustomLink,
  img: MdxImage,
  Image: MdxImage,
  Callout,
  hr: () => <hr className="border-hair-strong" />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
