const paths: Record<string, string> = {
  print: "M6 8V2h12v6M6 17H3V8h18v9h-3M6 13h12v9H6ZM17 10h1",
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  document: "M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8",
  knowledge: "M4 4h6l2 2h8v15H4ZM8 10h8M8 14h8M8 18h5",
  incident: "m12 3 10 18H2ZM12 9v5M12 17h.01",
  learning: "m2 8 10-5 10 5-10 5ZM6 10v7q6 5 12 0v-7M22 8v9",
  approval: "M9 3h6v3H9ZM8 4H5v18h14V4h-3M8 14l3 3 5-7",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  logout: "M10 3H3v18h7M9 12h13m-5-5 5 5-5 5",
  plus: "M12 4v16M4 12h16",
  clock: "M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.document} />
    </svg>
  );
}
