import type { RouteObject } from 'react-router';
import { createBrowserRouter, Navigate } from 'react-router';

import { LockPage } from '@/features/auth/LockPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { PinLockProvider } from '@/features/auth/PinLockProvider';
import { BayPage } from '@/routes/BayPage';
import { OwnerPage } from '@/routes/OwnerPage';
import { StockPage } from '@/routes/StockPage';

import { RequireOwner } from './guards/RequireOwner';
import { RequireStaff } from './guards/RequireStaff';
import { RequireUnlocked } from './guards/RequireUnlocked';
import { PublicLayout } from './layouts/PublicLayout';
import { StaffLayout } from './layouts/StaffLayout';

export const routes: RouteObject[] = [
  {
    element: <PinLockProvider />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            path: '/login',
            element: <LoginPage />,
          },
          {
            path: '/lock',
            element: <LockPage />,
          },
        ],
      },
      {
        element: <RequireStaff />,
        children: [
          {
            element: <RequireUnlocked />,
            children: [
              {
                element: <StaffLayout />,
                children: [
                  {
                    path: '/',
                    element: <Navigate to="/bay" replace />,
                  },
                  {
                    path: '/bay',
                    element: <BayPage />,
                  },
                  {
                    path: '/inventory',
                    element: <StockPage />,
                  },
                  {
                    element: <RequireOwner />,
                    children: [
                      {
                        path: '/owner',
                        element: <OwnerPage />,
                      },
                    ],
                  },
                ],
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
