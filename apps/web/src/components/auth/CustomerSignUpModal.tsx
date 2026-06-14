import { useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  vatNumber: string;
  registrationNumber: string;
  address: string;
  password: string;
  confirmPassword: string;
}

const empty: FormState = {
  name: '',
  phone: '',
  email: '',
  vatNumber: '',
  registrationNumber: '',
  address: '',
  password: '',
  confirmPassword: '',
};

export default function CustomerSignUpModal({ open, onClose }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleClose = () => {
    setForm(empty);
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/v1/customers/register', {
        name:               form.name,
        phone:              form.phone || undefined,
        email:              form.email,
        vatNumber:          form.vatNumber || undefined,
        registrationNumber: form.registrationNumber || undefined,
        password:           form.password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Sign up failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Customer Sign Up</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {success ? (
            <div className="py-8 text-center">
              <p className="text-green-600 font-medium text-lg">Account created successfully!</p>
              <p className="text-gray-500 mt-2 text-sm">You can now log in with your email and password.</p>
            </div>
          ) : (
            <form id="customer-signup-form" onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  required
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Name"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="Mobile"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="Email(Username)"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vat Number</label>
                <input
                  value={form.vatNumber}
                  onChange={set('vatNumber')}
                  placeholder="Vat Number"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  value={form.registrationNumber}
                  onChange={set('registrationNumber')}
                  placeholder="Registration Number"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={set('address')}
                  placeholder="Address"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Password (min 8 characters)"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  required
                  type="password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  placeholder="Confirm Password"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 rounded bg-gray-600 text-white text-sm hover:bg-gray-700"
          >
            Close
          </button>
          {!success && (
            <button
              type="submit"
              form="customer-signup-form"
              disabled={submitting}
              className="px-5 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Signing up…' : 'Sign Up'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
