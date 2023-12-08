import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useMDXComponent } from "next-contentlayer/hooks";

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
  if (href && href.startsWith("#")) {
    return (
      <a href={href} {...rest} className="rounded bg-brand bg-opacity-20 p-1">
        {children}
      </a>
    );
  } else if (href && href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
        className="rounded bg-brand bg-opacity-20 p-1"
      >
        {children}
      </a>
    );
  } else {
    return (
      <Link
        href={href || "#"}
        {...rest}
        className="rounded bg-brand bg-opacity-20 p-1"
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

const Code = (props: any) => {
  console.log("props", props);
  const { children } = props;
  return (
    <code className="not-prose rounded bg-black bg-opacity-30 p-1 font-mono font-semibold text-white">
      {children}
    </code>
  );
};

const components = {
  a: CustomLink,
  Image: RoundedImage,
  img: RoundedImg,
  Callout: Callout,
  // code: Code,
};

export function MDX({ code }: { code: string }) {
  const Component = useMDXComponent(code);

  return (
    <article className="prose-quoteless prose prose-invert relative">
      <Component components={{ ...components }} />
    </article>
  );
}
