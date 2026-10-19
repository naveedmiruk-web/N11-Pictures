import { client } from "../../sanity";
import { PortableText } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/types";
import ContactCta from "../components/ContactCta";

export type FilmProject = {
  _id: string;
  title: string;
  category?: string;
  slug?: string;
  synopsisHeading?: string;
  synopsis?: string;
  projectDetails?: PortableTextBlock[];
  trailerUrl?: string;
  btsVideos?: string[];
  heroImageUrl?: string;
  gallery?: Array<{ imageUrl?: string; alt?: string }>;
};

const projectFields = `{
  _id,
  title,
  category,
  "slug": slug.current,
  synopsisHeading,
  synopsis,
  projectDetails,
  trailerUrl,
  btsVideos,
  "heroImageUrl": heroImage.asset->url,
  "gallery": gallery[]{ "imageUrl": asset->url, alt }
}`;

export async function getProjectBySlug(slug?: string) {
  if (slug) {
    const query = `*[_type == "film" && slug.current == $slug][0]${projectFields}`;

    return client.fetch<FilmProject | null>(query, { slug });
  }

  const query = `*[_type == "film"][0]${projectFields}`;

  return client.fetch<FilmProject | null>(query);
}

export async function getProjectBySourcePath(category: string, slug: string) {
  const sourceUrl = new URL(`/${category}/${slug}`, "https://www.n11pictures.com").toString();
  const query = `*[_type == "film" && sourceMetadata.url == $sourceUrl][0]${projectFields}`;

  return client.fetch<FilmProject | null>(query, {sourceUrl});
}

function getVideoSource(url: string) {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    return {type: "embed" as const, src: `https://www.youtube.com/embed/${parsedUrl.pathname.slice(1)}`};
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const videoId =
      parsedUrl.searchParams.get("v") ??
      parsedUrl.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    if (videoId) return {type: "embed" as const, src: `https://www.youtube.com/embed/${videoId}`};
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const videoId = parsedUrl.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
    if (videoId) return {type: "embed" as const, src: `https://player.vimeo.com/video/${videoId}`};
  }

  if (/\.(mp4|webm|ogg)(?:$|[?#])/i.test(parsedUrl.pathname + parsedUrl.search)) {
    return {type: "file" as const, src: url};
  }
  return {type: "embed" as const, src: url};
}

function ProjectVideo({ url, title }: { url: string; title: string }) {
  const source = getVideoSource(url);

  return (
    <div style={{paddingTop: "56.17021276595745%"}} className="w-embed-youtubevideo youtube">
      {source.type === "file" ? (
        <video
          src={source.src}
          controls
          playsInline
          preload="metadata"
          aria-label={title}
          style={{position: "absolute", inset: 0, width: "100%", height: "100%"}}
        />
      ) : (
        <iframe
          src={source.src}
          frameBorder={0}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
          }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={title}
        />
      )}
    </div>
  );
}

export function ProjectDetail({ project }: { project: FilmProject }) {
  const synopsisParagraphs = (project.synopsis ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const gallery = project.gallery?.filter((image) => image.imageUrl) ?? [];
  const heroImageUrl =
    project.heroImageUrl ??
    "/videos/Exclusive-Behind-the-Scenes---poster-00001.jpg";
  const additionalVideos = [...new Set(project.btsVideos ?? [])].filter(
    (url) => url !== project.trailerUrl,
  );

  return (
    <>
      <section
        data-w-id="8d1538cf-5b1c-7145-c1d0-ff8522a17fbc"
        className="section-top full"
      >
        <div className="content">
          <h1 className="heading-project large">{project.title}</h1>
          <div className="info-project">{project.category ?? "Film"}</div>
        </div>
        <div
          data-poster-url={heroImageUrl}
          data-autoplay="true"
          data-loop="true"
          className="bg-video-full w-background-video w-background-video-atom"
          style={{
            backgroundImage: `url("${heroImageUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="bg-gradient" />
        </div>
      </section>

      <section
        data-w-id="47fe705f-ad91-7e1e-b3c2-f54ffecfb0fb"
        className="section"
      >
        {project.trailerUrl ? <ProjectVideo url={project.trailerUrl} title={`${project.title} trailer`} /> : null}

        <div className="content project">
          <div className="content-narrow">
            <div className="rich-text-block w-richtext">
              {project.projectDetails?.length ? (
                <PortableText value={project.projectDetails} />
              ) : (
                <>
                  <h3>
                    <strong>{project.synopsisHeading ?? project.title}</strong>
                  </h3>
                  {synopsisParagraphs.map((paragraph, index) => (
                    <p key={`${project._id}-synopsis-${index}`}>{paragraph}</p>
                  ))}
                </>
              )}
            </div>
          </div>

          {additionalVideos.map((url, index) => (
            <ProjectVideo key={`${project._id}-video-${index}`} url={url} title={`${project.title} video ${index + 1}`} />
          ))}

          {gallery.map((image, index) => (
            <img
              key={`${project._id}-gallery-${index}`}
              src={image.imageUrl}
              loading={index === 0 ? "eager" : "lazy"}
              width={1920}
              sizes="100vw"
              alt={image.alt ?? `${project.title} image ${index + 1}`}
              className="image"
            />
          ))}
        </div>
      </section>

      <ContactCta />

      <section className="footer">
        <div>© 2025 N11 PICTURES. All Rights Reserved.</div>
      </section>
    </>
  );
}
