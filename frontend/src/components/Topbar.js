// src/components/Topbar.js
import { Bars3Icon } from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Topbar({ toggleSidebar }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Show Create button only on profiles and certificates pages
  const showCreateButton = location.pathname.includes('/profiles') ||
    location.pathname.includes('/certificates') ||
    location.pathname.includes('/profilescreate') ||
    location.pathname.includes('/createcertificate');

  return (
    <div className="w-full flex items-center bg-white shadow px-6 py-3 gap-4 relative">
      {/* Logo */}
      <div className="flex items-center">
        <img
          src="/TSL.png"
          alt="TSL Logo"
          className="h-14 w-14 mr-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate("/dashboard")}
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>

      {/* Hamburger */}
      <button onClick={toggleSidebar} className="p-2 rounded hover:bg-gray-200">
        <Bars3Icon className="h-6 w-6 text-gray-700" />
      </button>

      {/* Search Box */}
      {/*<input
        type="text"
        placeholder="Search accounts..."
        className="border rounded px-3 py-1 w-1/3"
      />*/}

      <div className="ml-auto flex items-center gap-4 relative">
        <span className="text-sm font-semibold">Account: Vitrux Ltd</span>

        {/* Dropdown Button - Only show on profiles/certificates pages */}
        {showCreateButton && (
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
            >
              Create
              <ChevronDownIcon className="h-4 w-4 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {open && (
              <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg rounded-md border z-50">
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate("/dashboard/profilescreate");
                  }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    console.log('Navigating to create certificate page...');
                    navigate("/dashboard/createcertificate");
                  }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Certificate
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
