// Self-hosted via next/font (downloaded at build time, served from this app — spec §4). All three families
// ship a Vietnamese subset (checked against google/fonts METADATA).
import { Be_Vietnam_Pro, Lexend, Newsreader } from 'next/font/google';

export const fontUi = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--nf-ui',
});

export const fontDisplay = Lexend({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--nf-display',
});

export const fontReading = Newsreader({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--nf-reading',
});

export const fontVariables = `${fontUi.variable} ${fontDisplay.variable} ${fontReading.variable}`;
