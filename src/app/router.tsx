import type { RouteObject } from 'react-router';
import { createBrowserRouter, Navigate } from 'react-router';

import { LoginPage } from '@/features/auth/LoginPage';

import { RequireAuth } from './RequireAuth';
import { StaffHomePage } from './StaffHomePage';

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <StaffHomePage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];

export const router = createBrowserRouter(routes);
