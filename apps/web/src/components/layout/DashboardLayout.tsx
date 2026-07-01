import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Users, Route, UserCircle,
  FileText, Receipt, Fuel, Settings, LogOut, Menu, X,
  Container, Bell, TrendingUp, ShieldCheck, CreditCard,
  ClipboardList, Package, Search, History, Building2, ScanLine, BadgeCheck, UserCheck, Wallet, BellRing, BarChart2,
  Map, MapPin,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import logo from '../../assets/uploads/pera.png';

const navItems = [
  { to: '/app/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/vehicles',         icon: Truck,           label: 'Perazim Trucks' },
  { to: '/app/trailers',         icon: Container,       label: 'Perazim Trailers' },
  { to: '/app/drivers',          icon: Users,           label: 'Drivers' },
  { to: '/app/customers',        icon: UserCircle,      label: 'Customers' },
  { to: '/app/trips',            icon: Route,           label: 'Trips' },
  { to: '/app/quotations',       icon: FileText,        label: 'Quotations' },
  { to: '/app/invoices',         icon: Receipt,         label: 'Invoices' },
  { to: '/app/payments',         icon: CreditCard,      label: 'Payments' },
  { to: '/app/fuel',             icon: Fuel,            label: 'Fuel' },
  { to: '/app/income-expenses',  icon: TrendingUp,      label: 'Income & Expenses' },
  { to: '/app/payroll',          icon: Wallet,          label: 'Payroll' },
  { to: '/app/inspections',      icon: ClipboardList,   label: 'Inspections' },
  { to: '/app/warehouses',       icon: Building2,       label: 'Warehouses' },
  { to: '/app/gate-scans',      icon: ScanLine,        label: 'Gate Scanning' },
  { to: '/app/pod',             icon: BadgeCheck,      label: 'Proof of Delivery' },
  { to: '/app/collections',     icon: UserCheck,       label: 'Customer Collection' },
  { to: '/app/loadsheets',       icon: Package,         label: 'Load Sheets' },
  { to: '/app/reminders',        icon: Bell,            label: 'Reminders' },
  { to: '/app/users',            icon: ShieldCheck,     label: 'Users' },
  { to: '/app/fuel-tanker',        icon: Fuel,             label: 'Fuel Tanker Division' },
  { to: '/app/flat-deck',          icon: Container,        label: 'Flat Deck Division' },
  { to: '/app/fleet-map',          icon: Map,              label: 'Fleet Live Map' },
  { to: '/app/geofences',          icon: MapPin,           label: 'Geofences' },
  { to: '/app/reporting',         icon: BarChart2,        label: 'Reports & Analytics' },
  { to: '/app/notifications',    icon: BellRing,        label: 'Notifications' },
  { to: '/app/audit-trail',      icon: History,         label: 'Audit Trail' },
  { to: '/app/settings',         icon: Settings,        label: 'Settings' },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/app/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 text-white flex flex-col transition-all duration-200 shrink-0`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {sidebarOpen && (
            <img src={logo} alt="Perazim Logistics" className="h-12 w-auto object-contain"/>
          )}
          {!sidebarOpen && (
            <img src={logo} alt="Perazim Logistics" className="h-8 w-8 object-contain"/>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white ml-auto">
            {sidebarOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} className="shrink-0"/>
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          {sidebarOpen && <p className="text-xs text-gray-400 mb-2 truncate">{user?.name}</p>}
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-full">
            <LogOut size={18} className="shrink-0"/>
            {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-3 flex items-center gap-4 shrink-0">
          <h1 className="text-sm text-gray-500 shrink-0">
            Welcome back, <span className="font-semibold text-gray-900">{user?.name}</span>
          </h1>
          <form onSubmit={handleSearch} className="flex-1 max-w-xl relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search bookings, VIN, reg, invoice, customer, driver…"
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50"
            />
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet/>
        </main>
      </div>
    </div>
  );
}
