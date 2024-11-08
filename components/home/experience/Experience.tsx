import { SectionHeader } from '@/components/utils/SectionHeader'
import { ExperienceItem } from './ExperienceItem'

import {experience} from '@/lib/experience'

export const Experience = () => {
  return (
    <section className="section-wrapper" id="experience">
      <SectionHeader title="Experience" dir="l" />
      {experience.slice().reverse().map((item) => (
      <ExperienceItem key={item.title} {...item} />
      ))}
    </section>
  )
}



