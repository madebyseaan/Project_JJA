import type { RouteObject } from 'react-router';
import { createBrowserRouter, Navigate } from 'react-router';

import { LockPage } from '@/features/auth/LockPage';
import { PinLockProvider } from '@/features/auth/PinLockProvider';
import { LoginPage } from '@/features/auth/LoginPage';

import { RequireAuth } from './RequireAuth';
import { RequireUnlocked } from './RequireUnlocked';
import { StaffHomePage } from './StaffHomePage';

export const routes: RouteObject[] = [
  {
    element: <PinLockProvider />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/lock',
        element: <LockPage />,
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireUnlocked />,
            children: [
              {
                path: '/',
                element: <StaffHomePage />,
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
