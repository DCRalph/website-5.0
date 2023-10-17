type Experience = {
  title: string
  position: string
  time: string
  location: string
  description: string
  tech: string[]
}

const experience: Experience[] = [
  {
    title: 'Bactosure',
    position: 'Software Engineer',
    time: '2023 - Present',
    location: 'Wellingotn, NZ',
    description:
      'I Work on software for the Bactosure product. Bactosure is a cost effective rapid test for detecting bacteria in water. I work on the software that runs on the device, the software that runs on the cloud, and the software that runs on the mobile app.',
    tech: [
      'C++',
      'Python',
      'Raspberry Pi',
      'ESP32',
      'Arduino',
      'AWS',
      'Firebase',
    ],
  },
]

export default experience
export { experience }
