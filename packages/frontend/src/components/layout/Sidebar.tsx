import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: "H" },
  { to: "/clients", label: "Clients", icon: "C" },
  { to: "/jobs/new", label: "New Job", icon: "+" },
  { to: "/jobs", label: "Job History", icon: "J" },
  { to: "/settings", label: "Settings", icon: "S" },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-gray-900 text-gray-100 flex flex-col">
      <div className="p-4 border-b border-gray-700 flex items-center gap-3">
        <img src="./logo.png" alt="SignInSentinel" className="w-8 h-8" />
        <h1 className="text-lg font-bold">SignInSentinel</h1>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`
            }
          >
            <span className="w-6 h-6 flex items-center justify-center bg-gray-700 rounded text-xs mr-3">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
