import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import type { MDXComponents } from 'mdx/types'

interface ICalloutProps {
  emoji: string;
  children: React.ReactNode;
}

type TCustomLink = React.PropsWithChildren<{
  href?: string;
}> &
  React.AnchorHTMLAttributes<HTMLAnchorElement>;

interface IRoundedImageProps {
  alt: string;
  src: string;
}

interface INewRoundedImageProps {
  alt?: string;
  src?: string;
}

interface IRoundedImgProps {
  src?: string;
  alt?: string;
}

const CustomLink = ({ href, children, ...rest }: TCustomLink) => {
  if (href?.startsWith("#")) {
    return (
      <a href={href} {...rest} className="rounded bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/30 p-1 transition-all duration-200 hover:from-brand/30 hover:to-brand/20 hover:border-brand/50 hover:scale-105 hover:shadow-lg hover:shadow-brand/20">
        {children}
      </a>
    );
  } else if (href?.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
        className="rounded bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/30 p-1 transition-all duration-200 hover:from-brand/30 hover:to-brand/20 hover:border-brand/50 hover:scale-105 hover:shadow-lg hover:shadow-brand/20"
      >
        {children}
      </a>
    );
  } else {
    return (
      <Link
        href={href ?? "#"}
        {...rest}
        className="rounded bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/30 p-1 transition-all duration-200 hover:from-brand/30 hover:to-brand/20 hover:border-brand/50 hover:scale-105 hover:shadow-lg hover:shadow-brand/20"
      >
        {children}
      </Link>
    );
  }
};

function RoundedImage(props: IRoundedImageProps) {
  const { src, alt } = props;

  const newProps: INewRoundedImageProps = {
    ...props,
  };

  return (
    <Image
      src={src}
      alt={alt}
      width={10000}
      height={10000}
      className="w-full rounded-lg shadow-lg dark:shadow-neutral-900"
      {...newProps}
    />
  );
}

function RoundedImg(props: IRoundedImgProps) {
  const { src, alt } = props;

  // console.log("props", props);

  if (src === undefined) return <></>;
  if (alt === undefined) return <></>;

  return (
    <Image
      src={src}
      alt={alt}
      width={10000}
      height={10000}
      className="w-full rounded-lg shadow-lg dark:shadow-neutral-900"
    />
  );
}

const Callout = (props: ICalloutProps) => {
  return (
    <div className="my-8 flex rounded-lg border border-neutral-300 bg-neutral-200 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mr-4 flex w-4 items-center">{props.emoji}</div>
      <div className="callout w-full">{props.children}</div>
    </div>
  );
};

const HorizontalRule = () => {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-border/60 to-transparent"></div>
};

const Code = (props: { children: React.ReactNode }) => {
  const { children } = props;
  return (
    <code className="not-prose inline-flex items-center px-2 py-1 rounded-md bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/30 font-mono text-sm font-medium text-white/90 shadow-sm">
      {children}
    </code>
  );
};

const components = {
  a: CustomLink,
  Image: RoundedImage,
  img: RoundedImg,
  Callout: Callout,
  hr: HorizontalRule,
  // code: Code,
};

// export function MDX({ code }: { code: string }) {
//   const Component = useMDXComponent(code);

//   return (
//     <article className="prose-quoteless prose prose-invert relative">
//       <Component components={{ ...components }} />
//     </article>
//   );
// }

export function useMDXComponents(): MDXComponents {
  return components
}
