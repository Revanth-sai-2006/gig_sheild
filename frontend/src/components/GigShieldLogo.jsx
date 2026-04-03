export default function GigShieldLogo({ className = "", title = "Gig Shield logo" }) {
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label={title}>
      <path
        d="M20 12h40l16 16v48a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M60 12v16h16" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 38h24M34 50h20M34 62h14" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M70 46 84 51v13.5c0 9.1-5.9 16.8-14 19.8-8.1-3-14-10.7-14-19.8V51l14-5Z"
        fill="var(--logo-shield-fill, #3b82c4)"
        stroke="var(--logo-shield-stroke, #3b82c4)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
