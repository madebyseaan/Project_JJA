import type { RouteObject } from 'react-router';
import { createBrowserRouter, Navigate } from 'react-router';

import { LockPage } from '@/features/auth/LockPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { PinLockProvider } from '@/features/auth/PinLockProvider';
import { BayPage } from '@/routes/BayPage';
import { OwnerAuditPage } from '@/routes/OwnerAuditPage';
import { OwnerPage } from '@/routes/OwnerPage';
import { OwnerSalesPage } from '@/routes/OwnerSalesPage';
import { OwnerSettingsPage } from '@/routes/OwnerSettingsPage';
import { ReceiptPage } from '@/routes/ReceiptPage';
import { StockPage } from '@/routes/StockPage';
import { TicketPage } from '@/routes/TicketPage';
import { VerifyPage } from '@/routes/VerifyPage';

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
          {
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
                    element: <Navigate to="/bay" replace />,
                  },
                  {
                    path: '/bay',
                    element: <BayPage />,
                  },
                  {
                    path: '/bay/ticket/:id',
                    element: <TicketPage />,
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
                      {
                        path: '/owner/sales',
                        element: <OwnerSalesPage />,
                      },
                      {
                        path: '/owner/audit',
                        element: <OwnerAuditPage />,
                      },
                      {
                        path: '/owner/settings',
                        element: <OwnerSettingsPage />,
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
