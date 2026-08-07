// Iconos de línea (stroke) para la app. Uso: <Icon name="dashboard" />
type Name =
  | "dashboard" | "squad" | "pitch" | "market" | "coach" | "stadium"
  | "table" | "logout" | "bell" | "search" | "chevron" | "spark" | "wallet" | "shield" | "book"
  | "more" | "close";

const paths: Record<Name, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  squad: <><circle cx="9" cy="8" r="3" /><path d="M4 20a5 5 0 0 1 10 0" /><path d="M16 6a3 3 0 0 1 0 6M15 20a5 5 0 0 1 5-4" /></>,
  pitch: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M3 9h4v6H3M21 9h-4v6h4" /><circle cx="12" cy="12" r="2.5" /></>,
  market: <><path d="M4 4h2l1.6 10.4a2 2 0 0 0 2 1.6h7a2 2 0 0 0 2-1.6L20 7H6" /><circle cx="10" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></>,
  coach: <><path d="M8 4h8l-1 6a3 3 0 0 1-6 0z" /><path d="M12 13v5M8 21h8" /></>,
  stadium: <><path d="M3 13c3-3 15-3 18 0" /><path d="M3 13v4c3 2.2 15 2.2 18 0v-4" /><path d="M8 11.5V8m4 3.5V7m4 4.5V8" /></>,
  table: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M9 4v16" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  spark: <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1z" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h3M3 9h18" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M9 7h7M9 11h7" /></>,
  more: <><rect x="4" y="4" width="6" height="6" rx="1.6" /><rect x="14" y="4" width="6" height="6" rx="1.6" /><rect x="4" y="14" width="6" height="6" rx="1.6" /><rect x="14" y="14" width="6" height="6" rx="1.6" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

export default function Icon({ name, size = 20 }: { name: Name; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
