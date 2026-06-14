import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import hero1 from '../../assets/uploads/slide-1.jpg';
import hero2 from '../../assets/uploads/slide-2.jpg';
import hero3 from '../../assets/uploads/slide-3.jpg';

const heroImages = [hero1, hero2, hero3];

export default function DriverSignupPage() {
  const navigate = useNavigate();

  const [currentImage, setCurrentImage] = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);

  const [form, setForm] = useState({
    name: '', mobile: '', email: '', password: '',
    licenseNo: '', licenseExpiry: '', totalExperience: '', age: '',
    dateOfJoining: '', reference: '', address: '',
  });

  useEffect(() => {
    const t = setInterval(() => setCurrentImage((p) => (p + 1) % heroImages.length), 5000);
    return () => clearInterval(t);
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setSubmitting(true);
    try {
      await axios.post('/api/v1/drivers/register', {
        name:            form.name,
        mobile:          form.mobile,
        email:           form.email,
        password:        form.password,
        licenseNo:       form.licenseNo,
        licenseExpiry:   form.licenseExpiry   || undefined,
        totalExperience: form.totalExperience || undefined,
        age:             form.age             ? Number(form.age) : undefined,
        dateOfJoining:   form.dateOfJoining   || undefined,
        reference:       form.reference       || undefined,
        address:         form.address         || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Hero background */}
      <img
        src={heroImages[currentImage]}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover transition-all duration-1000"
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* Scrollable content */}
      <div className="relative z-10 min-h-screen flex items-start justify-center py-12 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
          <div className="flex">
            {/* Left avatar panel */}
            <div className="hidden md:flex w-48 bg-gray-50 border-r items-center justify-center py-12 flex-shrink-0">
              <svg viewBox="0 0 120 140" className="w-32 h-32 text-gray-700" fill="currentColor">
                <circle cx="60" cy="38" r="28" />
                <path d="M10 130 Q10 90 60 90 Q110 90 110 130 Z" />
                <circle cx="88" cy="105" r="18" fill="white" stroke="currentColor" strokeWidth="3"/>
                <line x1="88" y1="95" x2="88" y2="115" stroke="currentColor" strokeWidth="3"/>
                <line x1="78" y1="105" x2="98" y2="105" stroke="currentColor" strokeWidth="3"/>
              </svg>
            </div>

            {/* Form */}
            <div className="flex-1 p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your new driver account</h1>
              <p className="text-sm text-gray-500 mb-6">
                Please use the form below to edit your information as required.
                Please note that this account will require validation.
              </p>

              {success ? (
                <div className="py-8 text-center">
                  <p className="text-green-600 font-semibold text-lg">Account created successfully!</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Your account is pending admin validation. You will be notified once approved.
                  </p>
                  <button
                    onClick={() => navigate('/drivers/d_login')}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Go to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                  )}

                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name</label>
                      <input required value={form.name} onChange={set('name')} placeholder="John Doe"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                      <input required value={form.mobile} onChange={set('mobile')} placeholder="0831234567"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input required type="email" value={form.email} onChange={set('email')} placeholder="name@domain.co.za"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-gray-400 font-normal">(Min 6 characters)</span></label>
                      <input required type="password" value={form.password} onChange={set('password')} minLength={6}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                      <input required value={form.licenseNo} onChange={set('licenseNo')} placeholder="0000000"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date</label>
                      <input type="date" value={form.licenseExpiry} onChange={set('licenseExpiry')}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                      <input value={form.totalExperience} onChange={set('totalExperience')} placeholder="0"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                      <input type="number" min={18} value={form.age} onChange={set('age')} placeholder="0"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* Row 4 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Joined Dated</label>
                      <input type="date" value={form.dateOfJoining} onChange={set('dateOfJoining')}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Notes</label>
                      <input value={form.reference} onChange={set('reference')} placeholder="Reference: / Notes:"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea value={form.address} onChange={set('address')} placeholder="Address" rows={2}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-gray-500">
                      Already have an account?{' '}
                      <Link to="/drivers/d_login" className="text-blue-600 hover:underline">Log in</Link>
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {submitting ? 'Creating…' : 'Create Account'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 bg-white/10 backdrop-blur-sm py-4">
        <div className="flex justify-center gap-6 text-white text-sm">
          <a href="#" className="hover:underline">FAQ</a>
          <span>|</span>
          <a href="#" className="hover:underline">Contact Us</a>
          <span>|</span>
          <a href="#" className="hover:underline">Terms of Use</a>
          <span>|</span>
          <a href="#" className="hover:underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
