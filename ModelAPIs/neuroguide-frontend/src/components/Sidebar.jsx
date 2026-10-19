import Link from "next/link";

const defaultItems = [
  { label: "Home", href: "/" },
  { label: "Activity", href: "/activity" },
  { label: "Progress", href: "/progress" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
];

/**
 * Vertical navigation for authenticated/dashboard pages.
 * Pass `activeItem` as the label or href of the current page.
 */
export default function Sidebar({
  items = defaultItems,
  activeItem = "",
  className = "",
  ariaLabel = "Main navigation",
}) {
  return (
    <aside
      className={`min-h-full w-full border-b border-[#c9c9c9] bg-white text-[#666] sm:w-40 sm:min-w-40 sm:border-b-0 sm:border-r ${className}`.trim()}
    >
      <nav aria-label={ariaLabel}>
        <ul className="m-0 flex list-none overflow-x-auto p-0 sm:block">
          {items.map((item) => {
            const active = activeItem === item.label || activeItem === item.href;

            return (
              <li key={item.href}>
                <Link
                  className={`flex min-h-11 shrink-0 items-center gap-2.5 border-t-[3px] px-3.5 text-sm text-inherit no-underline transition-colors hover:bg-[#f5f5f5] hover:text-[#252525] focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#454545] sm:min-h-12 sm:shrink sm:border-l-[3px] sm:border-t-0 sm:px-5 ${
                    active
                      ? "border-t-[#686868] bg-[#f0f0f0] font-bold text-[#171717] sm:border-l-[#686868]"
                      : "border-t-transparent sm:border-l-transparent"
                  }`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon ? (
                    <span className="inline-flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center" aria-hidden="true">
                      {item.icon}
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
