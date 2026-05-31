# Socka Website

Astro website for Socijalna samoposluga "Kruh sv. Antuna" Varaždin.

## Running the project

```bash
npm install
npm run dev
```

If you previously deleted the `socka-website` folder while your terminal was inside it, first move back to the parent folder:

```bash
cd ~/Desktop/agape/agape
cd socka-website
npm install
npm run dev
```

## Editing basic information

Main website information, contact details, and social media links are located in:

```text
src/lib/site.ts
```

## Adding announcements

Announcements are Markdown files located in:

```text
src/content/obavijesti/
```

Each announcement must include `image`, `title`, `description`, `pubDate`, and `draft: false`.

The announcement template is located here:

```text
templates/obavijest-template.md
```

## Announcement images

Announcement images can be placed in:

```text
public/images/obavijesti/
```

Inside an announcement file, the image can then be referenced like this:

```yaml
image: "/images/obavijesti/image-name.jpg"
```
