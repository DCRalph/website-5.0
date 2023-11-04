import {
  type ComputedFields,
  defineDocumentType,
  makeSource,
} from "contentlayer/source-files";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";

const computedFields: ComputedFields<"ProjectMDX"> = {
  techArr: {
    type: "list",
    resolve: (doc) =>
      (doc.tech as string)
        .replaceAll("\\\\", "[BACKSLASH]")
        .split("\\")
        .map((s) => s.trim().replaceAll("[BACKSLASH]", "\\")),
  },
};

const ProjectMDX = defineDocumentType(() => ({
  name: "ProjectMDX",
  filePathPattern: `**/*.mdx`,
  contentType: "mdx",
  fields: {
    title: {
      type: "string",
      required: true,
    },
    publishedAt: {
      type: "string",
      required: true,
    },
    updatedAt: {
      type: "string",
      required: false,
    },
    coverImage: {
      type: "string",
      required: true,
    },
    projectLink: {
      type: "string",
      required: false,
    },
    codeLink: {
      type: "string",
      required: false,
    },
    description: {
      type: "string",
      required: true,
    },
    tech: {
      type: "string",
      required: true,
    },
  },
  computedFields,
}));

interface iNode {
  children: iNode[];
  properties: {
    className: string[];
  };
  type: string;
  value: string;
}

export default makeSource({
  contentDirPath: "content",
  documentTypes: [ProjectMDX],
  mdx: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypePrettyCode,
        {
          theme: "github-dark",
          keepBackground: false,

          onVisitLine(node: iNode) {
            // Prevent lines from collapsing in `display: grid` mode, and allow empty
            // lines to be copy/pasted
            if (node.children.length === 0) {
              node.children = [
                {
                  type: "text",
                  value: " ",
                  properties: { className: [] },
                  children: [],
                },
              ];
            }
          },

          // onVisitHighlightedLine(node: iNode) {
          //   node.properties.className.push("line--highlighted");
          // },

          // onVisitHighlightedWord(node: iNode) {
          //   node.properties.className = ["word--highlighted"];
          // },
        },
      ],
    ],
  },
});
