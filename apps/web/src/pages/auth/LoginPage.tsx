import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';

import background from '../../assets/uploads/background.jpg';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.username, data.password);
      navigate('/app/dashboard');
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.error || 'Login failed. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Background */}
      <img
        src={background}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/20" />

      {/* Card */}
      <div className="relative z-10 bg-white/95 shadow-2xl rounded-sm w-full max-w-xs px-8 py-8">
        {/* Company name */}
        <p className="text-center text-xs font-semibold tracking-widest text-gray-700 uppercase mb-6">
          Perazim Auto Transporters
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Username */}
          <div className="relative">
            <input
              {...register('username')}
              placeholder="Username"
              autoComplete="username"
              className="w-full border border-gray-300 rounded-sm px-3 py-2.5 pr-9 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400"
            />
            <Mail size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            {errors.username && (
              <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <input
              {...register('password')}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-sm px-3 py-2.5 pr-9 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400"
            />
            <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Root error */}
          {errors.root && (
            <p className="text-red-600 text-xs">{errors.root.message}</p>
          )}

          {/* Sign In button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-sm transition-colors disabled:opacity-60"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
