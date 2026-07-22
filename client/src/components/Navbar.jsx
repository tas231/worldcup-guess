import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { Trophy, LayoutDashboard, ListOrdered, Sparkles, LogOut, ShieldAlert, BookOpen } from 'lucide-react';
import clsx from 'clsx';
import { ConfigContext } from '../context/ConfigContext';

const Navbar = ({ user, onLogout }) => {
  const { config } = useContext(ConfigContext);
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/leaderboard', icon: ListOrdered, label: 'Leaderboard' },
    { to: '/insights', icon: Sparkles, label: 'AI Insights' },
    { to: '/rules', icon: BookOpen, label: 'Rules' },
  ];

  if (user && user.isAdmin) {
    navItems.push({ to: '/admin', icon: ShieldAlert, label: 'Admin' });
  }

  return (
    <nav className="glass sticky top-0 z-50 px-4 py-3 mb-8 border-b-0 border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Trophy className="w-6 h-6 text-primary" />
          <span className="font-bold text-xl hidden sm:block whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{config?.tournamentName || 'WC Tipping'}</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-6 bg-black/20 px-2 sm:px-6 py-2 rounded-full border border-white/5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                "flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300",
                isActive 
                  ? "bg-white/10 text-white shadow-sm" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={18} />
              <span className="text-sm font-medium hidden sm:block">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-semibold text-white">{user.name}</span>
            <span className="text-xs text-primary">{user.department}</span>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
