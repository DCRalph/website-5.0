type Role = {
  company: string;
  position: string;
  time: string;
  description: string;
};

// Newest first. `experience[0]` is the current role and is shown in the sidebar.
export const experience = [
  {
    company: "Bactosure",
    position: "Head of Technology Operations",
    time: "Jan 2026 - now",
    description:
      "Driving networking, security, DevOps, and cloud systems, while continuing active development of embedded device firmware and web applications."
  },
  {
    company: "Bactosure",
    position: "Technology Manager",
    time: "Nov 2024 - Dec 2025",
    description:
      "Infrastructure and technical support behind the water testing product.",
  },
  {
    company: "Bactosure",
    position: "Software Engineer",
    time: "Aug 2023 - Nov 2024",
    description: "Device firmware and cloud systems for a rapid bacteria test.",
  },
] as const satisfies Role[];

// Side roles alongside the main job. Listed under Work and as "Also" in the sidebar.
export const sideGigs = [
  {
    company: "Atmos",
    position: "The Asset",
    time: "Feb 2026 - now",
    description:
      "Wellington promoter running immersive electronic music events.",
  },
] as const satisfies Role[];
