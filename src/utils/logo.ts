// Premium Corporate Logo for Workforce Analytics
// Handcrafted crisp SVG matching the uploaded brand asset.

export const LOGO_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <!-- Rounded corner outer container -->
  <rect x="3" y="3" width="94" height="94" rx="12" fill="#ffffff" stroke="#0a2540" stroke-width="3" />
  
  <g transform="translate(1, 1)">
    <!-- Clock outer circle arc -->
    <path d="M 45 42 A 18 18 0 1 1 53.5 27.5" fill="none" stroke="#0a2540" stroke-width="4.5" stroke-linecap="round" />
    
    <!-- Clock ticks -->
    <line x1="41" y1="23.5" x2="41" y2="27.5" stroke="#0a2540" stroke-width="3" stroke-linecap="round" />
    <line x1="23" y1="41.5" x2="27" y2="41.5" stroke="#0a2540" stroke-width="3" stroke-linecap="round" />
    
    <!-- Clock hands (Checkmark shape) -->
    <path d="M 31 31 L 41 41 L 51 29" fill="none" stroke="#0a2540" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
    
    <!-- Human silhouette head -->
    <circle cx="34" cy="51" r="5" fill="#0a2540" />
    
    <!-- Human silhouette torso -->
    <path d="M 26 65 C 26 59, 29 57, 34 57 C 39 57, 42 59, 42 65 Z" fill="#0a2540" />

    <!-- Bar chart bars -->
    <!-- Bar 1 (Light Blue) -->
    <rect x="47.5" y="44" width="6" height="21" rx="1.5" fill="#60a5fa" />
    <!-- Bar 2 (Medium Blue) -->
    <rect x="56.5" y="37" width="6" height="28" rx="1.5" fill="#2563eb" />
    <!-- Bar 3 (Dark Navy) -->
    <rect x="65.5" y="28" width="6" height="37" rx="1.5" fill="#0a2540" />

    <!-- Crescent Swoop underneath and sweeping to the right -->
    <path d="M 22 56 C 21 66, 29 74, 51 71 C 67 69, 78 57, 80 44 C 80 34, 76 34, 75 34 C 75 42, 72 52, 66 60 C 57 70, 43 70, 34 66 C 27 62, 23 59, 22 56 Z" fill="#0a2540" />
  </g>
</svg>`;

// Base64 encoding of the logo SVG string
export const LOGO_DATA_URI = `data:image/svg+xml;base64,${btoa(LOGO_SVG_STRING)}`;
