import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import logo from '../../assets/uploads/pera.png';
import CustomerSignUpModal from '../auth/CustomerSignUpModal';
import CustomerSignInModal from '../auth/CustomerSignInModal';

export default function Navbar() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [customerSignUpOpen, setCustomerSignUpOpen] = useState(false);
  const [customerSignInOpen, setCustomerSignInOpen] = useState(false);

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-24">

          {/* Logo */}
          <Link to="/">
            <img
              src={logo}
              alt="Perazim"
              className="h-14 md:h-16 object-contain"
            />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-8 text-gray-700">

            <Link
              to="/"
              className="hover:text-blue-600 transition"
            >
              Home
            </Link>

            {/* Login Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setLoginOpen(!loginOpen);
                  setSignupOpen(false);
                }}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Login
                <ChevronDown size={16} />
              </button>

              {loginOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg">
                  <Link
                    to="/drivers/d_login"
                    className="block px-4 py-3 hover:bg-gray-100"
                  >
                    as Driver
                  </Link>

                  <button
                    onClick={() => { setLoginOpen(false); setCustomerSignInOpen(true); }}
                    className="block w-full text-left px-4 py-3 hover:bg-gray-100"
                  >
                    as Customer
                  </button>
                </div>
              )}
            </div>

            {/* Sign Up Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setSignupOpen(!signupOpen);
                  setLoginOpen(false);
                }}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Sign Up
                <ChevronDown size={16} />
              </button>

              {signupOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg">
                  <Link
                    to="/drivers/d_signup"
                    className="block px-4 py-3 hover:bg-gray-100"
                  >
                    as Driver
                  </Link>

                  <button
                    onClick={() => { setSignupOpen(false); setCustomerSignUpOpen(true); }}
                    className="block w-full text-left px-4 py-3 hover:bg-gray-100"
                  >
                    as Customer
                  </button>
                </div>
              )}
            </div>

          </nav>
        </div>
      </div>
    </header>

    <CustomerSignUpModal
      open={customerSignUpOpen}
      onClose={() => setCustomerSignUpOpen(false)}
    />
    <CustomerSignInModal
      open={customerSignInOpen}
      onClose={() => setCustomerSignInOpen(false)}
    />
    </>
  );
}