import type { RouteObject } from 'react-router';
import { createBrowserRouter, Navigate } from 'react-router';

import { LockPage } from '@/features/auth/LockPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { PinLockProvider } from '@/features/auth/PinLockProvider';
import { GcashPage } from '@/routes/GcashPage';
import { ItemsPage } from '@/routes/ItemsPage';
import { OrderFormPage } from '@/routes/OrderFormPage';
import { OrdersPage } from '@/routes/OrdersPage';
import { ReceiptPage } from '@/routes/ReceiptPage';
import { ReportsPage } from '@/routes/ReportsPage';
import { SalesReceiptPage } from '@/routes/SalesReceiptPage';
import { SettingsPage } from '@/routes/SettingsPage';
import { VerifyPage } from '@/routes/VerifyPage';

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
          {
            // New sales-log digital receipt.
            path: '/s/:token',
            element: <SalesReceiptPage />,
          },
          {
            // Legacy receipt links stay available while old data is retained.
            path: '/r/:token',
            element: <ReceiptPage />,
          },
          {
            path: '/verify',
            element: <VerifyPage />,
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
                    element: <Navigate to="/orders" replace />,
                  },
                  {
                    path: '/orders',
                    element: <OrdersPage />,
                  },
                  {
                    path: '/orders/new',
                    element: <OrderFormPage />,
                  },
                  {
                    path: '/orders/:id',
                    element: <OrderFormPage />,
                  },
                  {
                    path: '/items',
                    element: <ItemsPage />,
                  },
                  {
                    path: '/reports',
                    element: <ReportsPage />,
                  },
                  {
                    path: '/reports/gcash',
                    element: <GcashPage />,
                  },
                  {
                    path: '/settings',
                    element: <SettingsPage />,
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
