"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SideBarItem } from "./SideBarItem";

export const SideBar = () => {
  const [selected, setSelected] = useState("");

  const items = [
    { label: "Home", href: "#hero" },
    { label: "About", href: "#about" },
    { label: "Projects", href: "#projects" },
    { label: "Exp", href: "#experience" },
    { label: "Contact", href: "#contact" },
  ];

  useEffect(() => {
    const sectionElements = items
      .map((item) => document.querySelector(item.href))
      .filter(Boolean) as HTMLElement[];

    // console.log("sectionElements", sectionElements);

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Sort by which section is closest to the top
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        // console.log("visibleSections", visibleSections);

        if (visibleSections.length > 0) {
          const id = visibleSections[0]?.target.id ?? "";
          const matchedItem = items.find(
            (item) => item.href.replace("#", "") === id
          );
          if (matchedItem) {
            setSelected(matchedItem.label);
          }
        }
      },
      {
        root: null,
        rootMargin: "0px 0px -50% 0px", // triggers when section is near middle
        threshold: 0.1,
      }
    );

    sectionElements.forEach((section) => observer.observe(section));

    return () => {
      sectionElements.forEach((section) => observer.unobserve(section));
      observer.disconnect();
    };
  }, []);

  return (
    <motion.nav
      initial={{ x: -70 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5 }}
      className="noScrollBar sticky top-0 z-20 flex h-screen flex-col items-center overflow-y-scroll bg-background-dark"
    >
      {items.map((item, index) => (
        <SideBarItem
          key={item.label}
          label={item.label}
          href={item.href}
          index={index}
          selectedLabel={selected}
          onClick={() => setSelected(item.label)}
        />
      ))}

      <div className="h-10 w-10 mt-auto mb-4 flex items-center justify-center bg-background rounded-md">
        V6
      </div>
    </motion.nav>
  );
};