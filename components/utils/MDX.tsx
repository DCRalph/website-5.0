import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useMDXComponent } from 'next-contentlayer/hooks'

export interface ICalloutProps {
  emoji: string
  children: React.ReactNode
}

export type TCustomLink = React.PropsWithChildren<{
  href?: string
}> &
  React.AnchorHTMLAttributes<HTMLAnchorElement>

export interface IRoundedImageProps {
  alt: string
  src: string
}

export interface INewRoundedImageProps {
  alt?: string
  src?: string
}

const CustomLink = ({ href, children, ...rest }: TCustomLink) => {
  if (href && href.startsWith('#')) {
    return (
      <a href={href} {...rest} className="decoration-brand">
        {children}
      </a>
    )
  } else if (href && href.startsWith('http')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
        className="decoration-brand">
        {children}
      </a>
    )
  } else {
    return (
      <Link href={href || '#'} {...rest} className="decoration-brand">
        {children}
      </Link>
    )
  }
}

function RoundedImage(props: IRoundedImageProps) {
  const { src, alt } = props

  const newProps: INewRoundedImageProps = {
    ...props,
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={10000}
      height={10000}
      className="w-full rounded-lg shadow-lg dark:shadow-neutral-900"
      {...newProps}
    />
  )
  // return <span>test</span>
}

const Callout = (props: ICalloutProps) => {
  return (
    <div className="my-8 flex rounded-lg border border-neutral-300 bg-neutral-200 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mr-4 flex w-4 items-center">{props.emoji}</div>
      <div className="callout w-full">{props.children}</div>
    </div>
  )
}

const components = {
  a: CustomLink,
  Image: RoundedImage,
  // img: RoundedImage,
  Callout: Callout,
}

export function MDX({ code }: { code: string }) {
  const Component = useMDXComponent(code)

  return (
    <article className="prose-quoteless prose prose-neutral relative dark:prose-invert">
      <Component components={{ ...components }} />
      {/* <Component components={{ a: CustomLink }} /> */}
    </article>
  )
}
