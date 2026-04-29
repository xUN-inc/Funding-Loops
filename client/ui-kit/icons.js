// Inline SVG icons. Use `currentColor` so they pick up parent text color.
// Add more by following the same shape: 14x14 viewBox 16x16, stroke 1.5.

const Icons = {
  logo: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 12V7c0-2.8 2.2-5 5-5s5 2.2 5 5v5l-2-1-2 1-2-1-2 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="6" cy="7" r="1" fill="currentColor"/>
      <circle cx="10" cy="7" r="1" fill="currentColor"/>
    </svg>
  ),
  overview: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  building: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 14v-4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="5" y="6" width="2" height="2" rx=".5" fill="currentColor"/>
      <rect x="9" y="6" width="2" height="2" rx=".5" fill="currentColor"/>
    </svg>
  ),
  users: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 13c0-2.2 2.2-4 5-4 1.1 0 2.1.3 2.9.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 14c0-1.7 1.3-3 3-3s3 1.3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  briefcase: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5V3.5C5 2.7 5.7 2 6.5 2h3C10.3 2 11 2.7 11 3.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M2 9h12" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  spark: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5l1.6 4.4L14 7.5l-4.4 1.6L8 13.5 6.4 9.1 2 7.5l4.4-1.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
};

export default Icons;
