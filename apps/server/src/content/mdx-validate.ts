import { compile } from "@mdx-js/mdx";
import { remarkCallouts } from "@taoran/content/remark";
import remarkDirective from "remark-directive";

export interface MdxValidationIssue {
  line?: number;
  column?: number;
  reason: string;
}

export async function validatePostMdx(body: string): Promise<MdxValidationIssue | null> {
  try {
    await compile(body, {
      outputFormat: "function-body",
      remarkPlugins: [remarkDirective, remarkCallouts],
    });
    return null;
  } catch (error) {
    const issue = error as {
      line?: number;
      column?: number;
      reason?: string;
      message?: string;
      place?: { line?: number; column?: number };
    };
    return {
      line: issue.line ?? issue.place?.line,
      column: issue.column ?? issue.place?.column,
      reason: issue.reason ?? issue.message ?? "MDX 语法无效",
    };
  }
}
