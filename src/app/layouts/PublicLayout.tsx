import { Outlet } from 'react-router';

export function PublicLayout() {
  return (
    <div className="bg-paper min-h-screen">
      <Outlet />
    </div>
  );
}
