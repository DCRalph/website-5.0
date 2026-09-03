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
    time: "Jan 2026 – now",
    description:
      "Networking, security, devops and cloud across the product and the company.",
  },
  {
    company: "Bactosure",
    position: "Technology Manager",
    time: "Nov 2023 – Dec 2025",
    description:
      "Infrastructure and technical support behind the water testing product.",
  },
  {
    company: "Bactosure",
    position: "Software Engineer",
    time: "Aug 2023 – Nov 2024",
    description: "Device firmware and cloud systems for a rapid bacteria test.",
  },
] as const satisfies Role[];
