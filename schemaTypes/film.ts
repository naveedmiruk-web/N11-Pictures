import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'film',
  title: 'Film',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image (Poster/Cover)',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt Text',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'synopsis',
      title: 'Synopsis',
      type: 'text',
    }),
    defineField({
      name: 'synopsisHeading',
      title: 'Synopsis Heading',
      type: 'string',
    }),
    defineField({
      name: 'projectDetails',
      title: 'Project Details',
      description: 'Rich text content imported from the Webflow project page.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            {title: 'Normal', value: 'normal'},
            {title: 'Heading 2', value: 'h2'},
            {title: 'Heading 3', value: 'h3'},
            {title: 'Blockquote', value: 'blockquote'},
          ],
          lists: [
            {title: 'Bullet', value: 'bullet'},
            {title: 'Numbered', value: 'number'},
          ],
          marks: {
            decorators: [
              {title: 'Strong', value: 'strong'},
              {title: 'Emphasis', value: 'em'},
              {title: 'Underline', value: 'underline'},
            ],
            annotations: [
              {
                name: 'link',
                title: 'Link',
                type: 'object',
                fields: [
                  defineField({
                    name: 'href',
                    title: 'URL',
                    type: 'url',
                  }),
                ],
              },
            ],
          },
        }),
      ],
    }),
    defineField({
      name: 'trailerUrl',
      title: 'Main Trailer URL (YouTube/Vimeo)',
      type: 'url',
    }),
    defineField({
      name: 'btsVideos',
      title: 'Additional Video URLs',
      description: 'YouTube, Vimeo, or externally hosted video URLs. Video files stay on their streaming host.',
      type: 'array',
      of: [{type: 'url'}],
    }),
    defineField({
      name: 'gallery',
      title: 'Gallery Images',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: {hotspot: true},
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt Text',
              type: 'string',
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'credits',
      title: 'Credits (e.g., Director, DoP)',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'awards',
      title: 'Awards & Laurels',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'sourceMetadata',
      title: 'Source Metadata',
      type: 'object',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({
          name: 'system',
          title: 'Source System',
          type: 'string',
        }),
        defineField({
          name: 'itemId',
          title: 'Source Item ID',
          type: 'string',
        }),
        defineField({
          name: 'url',
          title: 'Source URL',
          type: 'url',
        }),
      ],
    }),
  ],
})