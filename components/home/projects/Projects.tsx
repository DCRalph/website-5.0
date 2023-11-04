import { SectionHeader } from '@/components/utils/SectionHeader'
import { Project } from './Project'

import { allProjectMDXes } from 'contentlayer/generated'
import { ProjectMDX } from 'contentlayer/generated'

const parseDate = (dateString: string): Date => {
  const parts = dateString.split('/') as [string, string, string]

  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)

  const date = new Date(year, month, day)

  return date
}

export const Projects = () => {
  return (
    <section className="section-wrapper" id="projects">
      <SectionHeader title="Projects" dir="r" />

      <div className={'grid grid-cols-1 lg:grid-cols-2 gap-8'}>
        {allProjectMDXes
          .sort((a: ProjectMDX, b: ProjectMDX) => {
            if (
              parseDate(a.publishedAt).getTime() >
              parseDate(b.publishedAt).getTime()
            ) {
              return -1
            }
            return 1
          })
          .map((project: ProjectMDX) => {
            // console.log(project)

            return <Project key={project.title} {...project} />
          })}
      </div>
    </section>
  )
}
