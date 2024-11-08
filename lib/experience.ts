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
    time: 'Aug 2023 - Nov 2024',
    location: 'Wellingotn, NZ',
    // description:
    //   'I Work on software for the Bactosure product. Bactosure is a cost effective rapid test for detecting bacteria in water. I work on the software that runs on the device, the software that runs on the cloud, and the software that runs on the mobile app.',
    description: 'Developed software for Bactosure, a cost-effective rapid test for detecting bacteria in water. Worked on device software and cloud-based systems to ensure reliable performance and a seamless user experience.',
    tech: [
      'C++',
      'Python',
      'Raspberry Pi',
      'ESP32',
      'Arduino',
      'AWS',
      'Firebase',
      'Git',
      "Tensorflow",
      "ERPNext"
    ],
  },
  {
    title: 'Bactosure',
    position: 'Technology Manager',
    time: 'Nov 2023 - Present',
    location: 'Wellingotn, NZ',
    description:
      `Transitioned into the Technology Manager role, having previously supported Bactosure's networking infrastructure and security needs. Now formally responsible for managing these areas, I focus on optimising network reliability, strengthening security protocols, and ensuring seamless technical support to enhance product performance and support commercial operations.`,
    tech: [
      'C++',
      'Python',
      'Raspberry Pi',
      'ESP32',
      'Arduino',
      'AWS',
      'Firebase',
      'Git',
      "Tensorflow",
      "ERPNext",
      "Linux",
      "Networking",
      "Security",

    ],
  },
]

export default experience
export { experience }
