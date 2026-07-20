import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  account_balance_wallet: (
    <>
      <path d="M4 7.5h14.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4.8A2.8 2.8 0 0 1 2 15.7V7.8A2.8 2.8 0 0 1 4.8 5H17" />
      <path d="M16 12h4.5" />
      <path d="M16.5 12.1h.01" />
    </>
  ),
  add: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  api: (
    <>
      <path d="M7 8c-1.7 0-3 1.1-3 2.5v3c0 1.4 1.3 2.5 3 2.5" />
      <path d="M7 8v8" />
      <path d="M17 8c1.7 0 3 1.1 3 2.5v3c0 1.4-1.3 2.5-3 2.5" />
      <path d="M17 8v8" />
      <path d="M10 12h4" />
    </>
  ),
  attach_money: (
    <>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c-.9-1-2.3-1.5-4-1.5-2.4 0-4 1.1-4 2.8 0 4 8 1.8 8 6.3 0 1.7-1.7 2.9-4.2 2.9-1.9 0-3.5-.7-4.6-1.9" />
    </>
  ),
  balance: (
    <>
      <path d="M12 4v16" />
      <path d="M6 7h12" />
      <path d="m6 7-3 6h6L6 7Z" />
      <path d="m18 7-3 6h6l-3-6Z" />
      <path d="M8 20h8" />
    </>
  ),
  bar_chart: (
    <>
      <path d="M5 19V9" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
    </>
  ),
  business: (
    <>
      <path d="M4 20V5.8A1.8 1.8 0 0 1 5.8 4h8.4A1.8 1.8 0 0 1 16 5.8V20" />
      <path d="M16 9h3.2A1.8 1.8 0 0 1 21 10.8V20" />
      <path d="M3 20h18" />
      <path d="M8 8h.01M12 8h.01M8 12h.01M12 12h.01M8 16h.01M12 16h.01" />
    </>
  ),
  calculate: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </>
  ),
  call: (
    <>
      <path d="M7.5 4.5 9.8 7a1.8 1.8 0 0 1 .3 1.9l-.7 1.5a12 12 0 0 0 4.2 4.2l1.5-.7a1.8 1.8 0 0 1 1.9.3l2.5 2.3a1.4 1.4 0 0 1 .1 2 3.7 3.7 0 0 1-3.6 1.1C9.8 18.1 5.9 14.2 4.4 8a3.7 3.7 0 0 1 1.1-3.6 1.4 1.4 0 0 1 2 .1Z" />
    </>
  ),
  category: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  check: (
    <>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </>
  ),
  check_circle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.4 12.4 2.4 2.4 4.8-5.2" />
    </>
  ),
  corporate_fare: (
    <>
      <path d="M4 20V6a2 2 0 0 1 2-2h8v16" />
      <path d="M14 9h4a2 2 0 0 1 2 2v9" />
      <path d="M3 20h18" />
      <path d="M8 8h2M8 12h2M8 16h2M17 13h.01M17 17h.01" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4.5L19.2 9.3a2.1 2.1 0 0 0 0-3l-1.5-1.5a2.1 2.1 0 0 0-3 0L4 15.5V20Z" />
      <path d="m13.8 5.8 4.4 4.4" />
    </>
  ),
  event_note: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 9h16" />
      <path d="M8 13h5M8 16h8" />
    </>
  ),
  fact_check: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m7.5 10 1.3 1.3L11 9" />
      <path d="M13 10h4" />
      <path d="m7.5 15 1.3 1.3L11 14" />
      <path d="M13 15h4" />
    </>
  ),
  filter_list: (
    <>
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.2a2.5 2.5 0 1 1 4.3 1.8c-.9.8-1.6 1.2-1.8 2.5" />
      <path d="M12 17h.01" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 5v5h5" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  home: (
    <>
      <path d="m3.5 11.5 8.5-7 8.5 7" />
      <path d="M5.5 10.5V20h5v-5h3v5h5v-9.5" />
    </>
  ),
  keyboard_arrow_down: (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  location_on: (
    <>
      <path d="M12 21s7-5.3 7-11a7 7 0 0 0-14 0c0 5.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
      <path d="M12 14v2" />
    </>
  ),
  logout: (
    <>
      <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M8 12h10" />
    </>
  ),
  mail: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m5 7 7 6 7-6" />
    </>
  ),
  manage_accounts: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 19a5.5 5.5 0 0 1 10.4 0" />
      <circle cx="17.5" cy="14.5" r="2.2" />
      <path d="M17.5 10.8v1M17.5 17v1M21.2 14.5h-1M15.5 14.5h-1" />
    </>
  ),
  more_horiz: (
    <>
      <path d="M6 12h.01M12 12h.01M18 12h.01" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3v-4Z" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  payments: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 15h4" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>
  ),
  receipt_long: (
    <>
      <path d="M6 3.8h12v16.4l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2V3.8Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  security: (
    <>
      <path d="M12 3.5 19 6v5.4c0 4.3-2.8 7.7-7 9.1-4.2-1.4-7-4.8-7-9.1V6l7-2.5Z" />
      <path d="m8.8 12 2.1 2.1 4.3-4.6" />
    </>
  ),
  settings: (
    <>
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" />
    </>
  ),
  south: (
    <>
      <path d="M12 4v15" />
      <path d="m6.5 13.5 5.5 5.5 5.5-5.5" />
    </>
  ),
  sync_alt: (
    <>
      <path d="M7 7h12" />
      <path d="m16 4 3 3-3 3" />
      <path d="M17 17H5" />
      <path d="m8 14-3 3 3 3" />
    </>
  ),
  timeline: (
    <>
      <path d="M4 17 9 9l4 4 7-8" />
      <circle cx="4" cy="17" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="13" cy="13" r="1.5" />
      <circle cx="20" cy="5" r="1.5" />
    </>
  ),
  trending_down: (
    <>
      <path d="m4 7 6 6 4-4 6 6" />
      <path d="M20 10v5h-5" />
    </>
  ),
  trending_up: (
    <>
      <path d="m4 16 6-6 4 4 6-6" />
      <path d="M15 8h5v5" />
    </>
  ),
  verified_user: (
    <>
      <path d="M12 3.5 19 6v5.4c0 4.3-2.8 7.7-7 9.1-4.2-1.4-7-4.8-7-9.1V6l7-2.5Z" />
      <path d="m8.8 12 2.1 2.1 4.3-4.6" />
    </>
  ),
};

export function Icon({
  className = "",
  filled = false,
  label,
  name,
}: {
  className?: string;
  filled?: boolean;
  label?: string;
  name: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={`g-icon${filled ? " filled" : ""}${className ? ` ${className}` : ""}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {icons[name] ?? icons.help}
      </svg>
    </span>
  );
}
