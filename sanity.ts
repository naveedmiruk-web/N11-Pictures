import { createClient } from "next-sanity";
import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";

export const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "c13lzzsv";
export const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-03-10";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
});

const imageBuilder = createImageUrlBuilder(client);

export const urlFor = (source: SanityImageSource) => {
  return imageBuilder.image(source);
};
