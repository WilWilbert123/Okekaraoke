import { redirect } from 'next/navigation';

// Old login URL — silently redirect to the real admin login
export default function AdminLoginRedirect() {
  redirect('/admin/admin/admin/admin/admin/login');
}
