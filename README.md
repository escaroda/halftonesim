# Halftone Sim

A generative WebGL art tool for creating mesmerizing moire, stipple, and halftone effects.

## Features

- **Real-time WebGL Rendering**: High-performance shader-based graphics.
- **Generative Effects**: Liquid warp, chromatic aberration, flares and sparks, and resonance pulse.
- **Color Animation**: Smoothly interpolate between curated color palettes.
- **URL Syncing**: Share your exact configuration with a single link.
- **High-Res Export**: Export your creations as PNGs up to 16x resolution.
- **Fullscreen Mode**: Immerse yourself in the generative art.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Deployment

This project is configured to automatically deploy to GitHub Pages using GitHub Actions. Simply push to the `main` branch, and the workflow will build and deploy the site.

Make sure to enable GitHub Pages in your repository settings:
1. Go to **Settings** > **Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
