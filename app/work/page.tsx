import { client } from "../../sanity";
import ContactCta from "../components/ContactCta";
import ProjectGrid from "./ProjectGrid";
import YouTubeEmbed from "../components/YouTubeEmbed";

export const dynamic = "force-dynamic";

type WorkProject = {
  _id: string;
  title: string;
  category?: string;
  slug?: string;
  imageUrl?: string;
  sourceUrl?: string;
};

type YouTubeVideo = {
  _id: string;
  title: string;
  youtubeUrl: string;
  description?: string;
  order?: number;
};

function categoryGroup(category?: string) {
  const normalized = (category ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  if (normalized.includes("behind the scenes")) return "behind";
  if (normalized.includes("hospital")) return "hospitality";
  if (normalized.includes("gym")) return "gyms";
  if (normalized.includes("short")) return "shorts";
  if (normalized.includes("music video") || normalized === "music") return "music";
  if (normalized.includes("ben samuel") || normalized.includes("bens samuel")) return "ben";
  if (normalized.includes("film festival")) return "festival";
  if (normalized.includes("show reel") || normalized.includes("showreel")) return "showreel";
  return normalized;
}

function projectHref(project: {slug?: string; sourceUrl?: string}) {
  if (project.sourceUrl) {
    const sourceUrl = new URL(project.sourceUrl);
    if (sourceUrl.hostname === "www.n11pictures.com") return sourceUrl.pathname;
  }

  return `/project/${project.slug}`;
}

export default async function WorkPage() {
  // Fetch all projects from Sanity CMS
  const projects = await client.fetch<WorkProject[]>(`*[_type == "film"]{
    _id,
    title,
    category,
    "slug": slug.current,
    "imageUrl": heroImage.asset->url,
    "sourceUrl": sourceMetadata.url
  }`);

  // Fetch YouTube videos from Sanity
  const youtubeVideos = await client.fetch<YouTubeVideo[]>(
    `*[_type == "youtubeVideo"] | order(order asc, _createdAt asc) {
      _id,
      title,
      youtubeUrl,
      description,
      order
    }`
  );

  const projectsWithHrefs = projects.map((project) => ({
    ...project,
    href: projectHref(project),
  }));
  const projectsByCategory = {
    hospitality: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "hospitality"),
    shorts: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "shorts"),
    gyms: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "gyms"),
    ben: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "ben"),
    showreel: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "showreel"),
    music: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "music"),
    behind: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "behind"),
    festival: projectsWithHrefs.filter((project) => categoryGroup(project.category) === "festival"),
  };

  return (
    <>
      <section className="section-3">
        <img src="/images/Untitled-design-10.png" loading="lazy" alt="" />
      </section>

      {/* 1. HOSPITALITY */}
      <section data-w-id="47fe705f-ad91-7e1e-b3c2-f54ffecfb0fb" data-scroll-reveal className="section-top">
        <div className="content">
          <h1 className="heading-project">HOSPITALITY</h1>
        </div>
        <section className="bg-img-full-1">
          <div className="bg-gradient"></div>
        </section>
      </section>
      
      <div className="collection-list-wrapper work-3 w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.hospitality}
          listClassName="collection-list-3"
        />
      </div>

      {/* 2. SHORT FILMS */}
      <section data-w-id="ed8229fc-ccc9-93da-5db6-342b0986af11" data-scroll-reveal className="section-top-copy">
        <div className="content">
          <h1 className="heading-project">SHORT FILMS</h1>
        </div>
      </section>
      
      <div className="collection-list-wrapper work-3 w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.shorts}
          listClassName="collection-list-3"
          emptyClassName="empty-state w-dyn-empty"
          emptyTextClassName="text-empty"
        />
      </div>

      {/* 3. GYMS */}
      <section data-w-id="847b60c7-59ee-ad6e-43f6-bc70f94444de" data-scroll-reveal className="section-top-copy">
        <div className="content">
          <h1 className="heading-project">GYMS</h1>
        </div>
      </section>
      
      <div className="collection-list-wrapper work-3 w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.gyms}
          listClassName="collection-list-3-copy"
        />
      </div>

      {/* 4. BEN SAMUEL JOB */}
      {/* <section data-w-id="3cce9b69-5688-2d31-dc1c-a9dd589a88c1" data-scroll-reveal className="section-top-copy">
        <div className="content">
          <h1 className="heading-project">BEN SAMUEL JOB</h1>
        </div>
      </section>
      
      <div className="collection-list-wrapper w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.ben}
          listClassName="collection-list-3"
          emptyClassName="empty-state w-dyn-empty"
        />
      </div> */}

      {/* 5. SHOW REELS */}
      <section data-w-id="7606712a-39ab-f274-bba4-2e5b741694f7" data-scroll-reveal className="section-top-copy">
        <div className="content">
          <h1 className="heading-project">Show reels</h1>
        </div>
      </section>
      
      <div className="collection-list-wrapper-3 work-3 w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.showreel}
          listClassName="collection-list-showreel"
          itemClassName="collection-item-4 w-dyn-item"
        />
      </div>

      {/* 6. MUSIC VIDEO */}
      <section data-w-id="2d1fee99-ba5a-bf54-6ab6-289264071b43" data-scroll-reveal className="section-top-copy">
        <div className="content">
          <h1 className="heading-project">Music video</h1>
        </div>
      </section>
      
      <div className="collection-list-wrapper work-3 w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.music}
          listClassName="collection-list-6"
        />
      </div>

      {/* 7. BEHIND THE SCENES */}
      <section data-w-id="7279220c-6430-ffc8-b724-7cc85c671d28" data-scroll-reveal className="section-top-copy">
        <div className="content">
          <h1 className="heading-project">BEHIND THE SCENES</h1>
        </div>
      </section>
      
      <div className="collection-list-wrapper work-3 w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.behind}
          listClassName="collection-list-5"
          emptyClassName="empty-state w-dyn-empty"
        />
      </div>

      {/* 8. FILM FESTIVAL STRATEGY */}
      <section data-w-id="db9507e7-5560-b7de-8b66-a296da437ec1" data-scroll-reveal className="section-top-copy">
        <div className="content">
          <h1 className="heading-project">FILM FESTIVAL STRATEGY</h1>
        </div>
      </section>
      
      <div className="collection-list-wrapper w-dyn-list">
        <ProjectGrid
          projects={projectsByCategory.festival}
          listClassName="collection-list-5"
          emptyClassName="empty-state w-dyn-empty"
        />
      </div>

      {/* FOLIE CLIPS — YouTube Section */}
      {youtubeVideos.length > 0 && (
        <>
          <section data-w-id="folie-clips-heading" data-scroll-reveal className="section-top-copy">
            <div className="content">
              <h1 className="heading-project">FOLIE CLIPS</h1>
            </div>
          </section>

          <div className="yt-grid-wrapper">
            {youtubeVideos.map((video) => (
              <div key={video._id} className="yt-card">
                <YouTubeEmbed url={video.youtubeUrl} title={video.title} />
                <p className="yt-card-title">{video.title}</p>
                {video.description && (
                  <p className="yt-card-desc">{video.description}</p>
                )}
              </div>
            ))}
          </div>

          <div className="yt-channel-cta">
            <a
              href="https://www.youtube.com/channel/UCLclLDRxwlSbz3dwkKN2jfw"
              target="_blank"
              rel="noopener noreferrer"
              className="button-3 w-button"
            >
              View Full Channel ↗
            </a>
          </div>
        </>
      )}

      {/* Support Us */}
      <div className="div-block-10">
        <a data-w-id="53e20133-d1b3-347f-b636-c580bff93625" href="https://ko-fi.com/naveedmir" target="_blank" rel="noopener noreferrer" className="button-3 w-button">Support Us</a>
      </div>

      {/* Call to Action */}
      <ContactCta />

      {/* Footer */}
      <section className="footer">
        <div>© 2026 N11 PICTURES. All Rights Reserved.</div>
      </section>
    </>
  );
}