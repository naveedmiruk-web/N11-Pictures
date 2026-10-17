'use client';

import { NextStudio } from 'next-sanity/studio';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import config from '../../../../studio-n11-pictures/sanity.config';

const embeddedConfig = {
  ...config,
  plugins: [structureTool(), visionTool()],
};

export default function StudioPage() {
  return <NextStudio config={embeddedConfig} />;
}
