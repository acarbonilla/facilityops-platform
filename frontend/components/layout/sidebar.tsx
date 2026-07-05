const navigation = [
  "Dashboard",
  "Master Data",
  "Tickets",
  "Maintenance",
  "Inspections",
  "Reports",
  "Settings",
];

export function Sidebar() {
  return (
    <aside className="border-b border-slate-200 bg-slate-950 px-3 py-3 text-slate-300 md:w-60 md:border-b-0 md:border-r md:py-6">
      <nav aria-label="Primary navigation">
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {navigation.map((item) => (
            <li key={item}>
              <span className="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-400">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
