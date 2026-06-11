import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export async function GET(context: APIContext) {
  const posts = (await getCollection("posts", (p) => p.data.status === "published")).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: "陶然 · Taoran",
    description: "一团温暖的粘土博客：前端、设计与生活。",
    site: context.site ?? "http://localhost:4321",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.date,
      link: `/posts/${post.data.slug}/`,
      categories: post.data.tags,
    })),
    customData: "<language>zh-CN</language>",
  });
}
