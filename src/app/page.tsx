import { Suspense } from "react";
import { Contact } from "~/components/Contact";
import { Projects } from "~/components/projects/Projects";
import { ScrollEdges } from "~/components/ScrollEdges";
import { Sidebar } from "~/components/Sidebar";
import { Work } from "~/components/Work";

export const metadata = {
  title: "William Giles | Software engineer",
  description: "Software engineer in Wellington, New Zealand.",
  openGraph: {
    title: "William Giles | Software engineer",
    description: "Software engineer in Wellington, New Zealand.",
    type: "website",
    url: "https://williamgiles.co.nz/",
    images: ["/logo.png"],
  },
};

export default function Page() {
  return (
    <>
      <ScrollEdges />
      <div className="grid min-h-screen md:grid-cols-2">
        <Sidebar />
        <main className="px-6 pb-32 md:pt-[10vh] md:pr-10 md:pl-0">
          <Work />
          <Suspense fallback={null}>
            <Projects />
          </Suspense>
          {/* <Contact /> */}
        </main>
      </div>
    </>
  );
}
