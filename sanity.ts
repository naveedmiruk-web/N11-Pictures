import { createClient } from "next-sanity";
import imageUrlBuilder from '@sanity/image-url';

export const client = createClient({
  projectId: "c13lzzsv",
  dataset: "production",
  apiVersion: "2024-03-10",
  useCdn: false, // Ensures you get fresh data during development
});

// Helper function to generate image URLs from Sanity
const builder = imageUrlBuilder(client);
export function urlFor(source: any) {
  return builder.image(source);
}