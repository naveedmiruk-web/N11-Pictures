"use client";

import { useState } from "react";

interface YouTubeEmbedProps {
  url: string;
  title: string;
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;

    if (parsed.hostname === "youtu.be") {
      videoId = parsed.pathname.slice(1);
    } else if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      videoId = parsed.searchParams.get("v");
      if (!videoId && parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1];
      }
      if (!videoId && parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1];
      }
    }

    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  } catch {
    return null;
  }
}

export default function YouTubeEmbed({ url, title }: YouTubeEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const embedUrl = getYouTubeEmbedUrl(url);

  if (!embedUrl) return null;

  return (
    <div className="yt-embed-wrapper">
      {!loaded && <div className="yt-skeleton" aria-hidden="true" />}
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`yt-iframe${loaded ? " yt-iframe--loaded" : ""}`}
      />
    </div>
  );
}
