import { lazy, Suspense } from "react";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { FocusedFlow } from "@/components/layout/FocusedFlow";
import { OrganizationStatusGate } from "@/components/layout/OrganizationStatusGate";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { PlatformRoute } from "@/components/layout/PlatformRoute";
import { PlatformShell } from "@/components/layout/PlatformShell";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { OfflineProvider } from "@/features/offline/OfflineProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Spinner } from "@/components/ui/spinner";

import {
  AcceptInvitationPage,
  LoginPage,
  PasswordResetPage,
} from "@/features/auth";
import NotFound from "@/app/NotFoundPage";

const DashboardPage = lazy(() =>
  import("@/features/dashboard").then(({ DashboardPage }) => ({
    default: DashboardPage,
  })),
);
const VehiclesPage = lazy(() =>
  import("@/features/vehicles").then(({ VehiclesPage }) => ({
    default: VehiclesPage,
  })),
);
const AddVehiclePage = lazy(() =>
  import("@/features/vehicles").then(({ AddVehiclePage }) => ({
    default: AddVehiclePage,
  })),
);
const EditVehiclePage = lazy(() =>
  import("@/features/vehicles").then(({ EditVehiclePage }) => ({
    default: EditVehiclePage,
  })),
);
const VehicleDetailPage = lazy(() =>
  import("@/features/vehicles").then(({ VehicleDetailPage }) => ({
    default: VehicleDetailPage,
  })),
);
const CustomersPage = lazy(() =>
  import("@/features/customers").then(({ CustomersPage }) => ({
    default: CustomersPage,
  })),
);
const AddCustomerPage = lazy(() =>
  import("@/features/customers").then(({ AddCustomerPage }) => ({
    default: AddCustomerPage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import("@/features/customers").then(({ CustomerDetailPage }) => ({
    default: CustomerDetailPage,
  })),
);
const EditCustomerPage = lazy(() =>
  import("@/features/customers").then(({ EditCustomerPage }) => ({
    default: EditCustomerPage,
  })),
);
const NewRentalPage = lazy(() =>
  import("@/features/rentals").then(({ NewRentalPage }) => ({
    default: NewRentalPage,
  })),
);
const RentalDetailPage = lazy(() =>
  import("@/features/rentals").then(({ RentalDetailPage }) => ({
    default: RentalDetailPage,
  })),
);
const RentalsPage = lazy(() =>
  import("@/features/rentals").then(({ RentalsPage }) => ({
    default: RentalsPage,
  })),
);
const MaintenancePage = lazy(() =>
  import("@/features/maintenance").then(({ MaintenancePage }) => ({
    default: MaintenancePage,
  })),
);
const AddMaintenancePage = lazy(() =>
  import("@/features/maintenance").then(({ AddMaintenancePage }) => ({
    default: AddMaintenancePage,
  })),
);
const MaintenanceDetailPage = lazy(() =>
  import("@/features/maintenance").then(({ MaintenanceDetailPage }) => ({
    default: MaintenanceDetailPage,
  })),
);
const ExpensesPage = lazy(() =>
  import("@/features/expenses").then(({ ExpensesPage }) => ({
    default: ExpensesPage,
  })),
);
const AddExpensePage = lazy(() =>
  import("@/features/expenses").then(({ AddExpensePage }) => ({
    default: AddExpensePage,
  })),
);
const ExpenseDetailPage = lazy(() =>
  import("@/features/expenses").then(({ ExpenseDetailPage }) => ({
    default: ExpenseDetailPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import("@/features/analytics").then(({ AnalyticsPage }) => ({
    default: AnalyticsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/features/reports").then(({ ReportsPage }) => ({
    default: ReportsPage,
  })),
);
const TasksPage = lazy(() =>
  import("@/features/tasks").then(({ TasksPage }) => ({ default: TasksPage })),
);
const AddTaskPage = lazy(() =>
  import("@/features/tasks").then(({ AddTaskPage }) => ({
    default: AddTaskPage,
  })),
);
const TaskDetailPage = lazy(() =>
  import("@/features/tasks").then(({ TaskDetailPage }) => ({
    default: TaskDetailPage,
  })),
);
const AccountPage = lazy(() =>
  import("@/features/account").then(({ AccountPage }) => ({
    default: AccountPage,
  })),
);
const PlatformOrganizationDetailPage = lazy(() =>
  import("@/features/platform").then(({ PlatformOrganizationDetailPage }) => ({
    default: PlatformOrganizationDetailPage,
  })),
);
const PlatformOrganizationsPage = lazy(() =>
  import("@/features/platform").then(({ PlatformOrganizationsPage }) => ({
    default: PlatformOrganizationsPage,
  })),
);

function RouteLoading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      role="status"
      aria-label="جارٍ تحميل الصفحة"
    >
      <Spinner />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/vehicles" component={VehiclesPage} />
      <Route path="/vehicles/add" component={AddVehiclePage} />
      <Route path="/vehicles/:id/edit" component={EditVehiclePage} />
      <Route path="/vehicles/:id" component={VehicleDetailPage} />
      <Route path="/customers" component={CustomersPage} />
      <Route path="/customers/add" component={AddCustomerPage} />
      <Route path="/customers/:id/edit" component={EditCustomerPage} />
      <Route path="/customers/:id" component={CustomerDetailPage} />
      <Route path="/rentals" component={RentalsPage} />
      <Route path="/rentals/:id" component={RentalDetailPage} />
      <Route path="/maintenance" component={MaintenancePage} />
      <Route path="/maintenance/:id" component={MaintenanceDetailPage} />
      <Route path="/expenses" component={ExpensesPage} />
      <Route path="/expenses/:id" component={ExpenseDetailPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/tasks/:id" component={TaskDetailPage} />
      <Route path="/account" component={AccountPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedShell() {
  return (
    <ProtectedRoute>
      <OfflineProvider>
        <OrganizationStatusGate>
          <AppShell>
            <Suspense fallback={<RouteLoading />}>
              <Router />
            </Suspense>
          </AppShell>
        </OrganizationStatusGate>
      </OfflineProvider>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Switch>
                {/* Public routes */}
                <Route path="/login" component={LoginPage} />
                <Route path="/password-reset" component={PasswordResetPage} />
                <Route
                  path="/accept-invitation"
                  component={AcceptInvitationPage}
                />

                <Route path="/platform/organizations/:organizationId">
                  {(params) => (
                    <PlatformRoute>
                      <Suspense fallback={<RouteLoading />}>
                        <PlatformShell>
                          <PlatformOrganizationDetailPage params={params} />
                        </PlatformShell>
                      </Suspense>
                    </PlatformRoute>
                  )}
                </Route>
                <Route path="/platform">
                  <PlatformRoute>
                    <Suspense fallback={<RouteLoading />}>
                      <PlatformShell>
                        <PlatformOrganizationsPage />
                      </PlatformShell>
                    </Suspense>
                  </PlatformRoute>
                </Route>

                {/* Full-screen flows render outside AppShell (no bottom navigation) */}
                <Route path="/rentals/new">
                  <ProtectedRoute>
                    <OfflineProvider>
                      <OrganizationStatusGate>
                        <FocusedFlow maxWidth="wide">
                          <Suspense fallback={<RouteLoading />}>
                            <NewRentalPage />
                          </Suspense>
                        </FocusedFlow>
                      </OrganizationStatusGate>
                    </OfflineProvider>
                  </ProtectedRoute>
                </Route>
                <Route path="/maintenance/add">
                  <ProtectedRoute>
                    <OfflineProvider>
                      <OrganizationStatusGate>
                        <FocusedFlow>
                          <Suspense fallback={<RouteLoading />}>
                            <AddMaintenancePage />
                          </Suspense>
                        </FocusedFlow>
                      </OrganizationStatusGate>
                    </OfflineProvider>
                  </ProtectedRoute>
                </Route>
                <Route path="/expenses/add">
                  <ProtectedRoute>
                    <OfflineProvider>
                      <OrganizationStatusGate>
                        <FocusedFlow>
                          <Suspense fallback={<RouteLoading />}>
                            <AddExpensePage />
                          </Suspense>
                        </FocusedFlow>
                      </OrganizationStatusGate>
                    </OfflineProvider>
                  </ProtectedRoute>
                </Route>
                <Route path="/tasks/add">
                  <ProtectedRoute>
                    <OfflineProvider>
                      <OrganizationStatusGate>
                        <FocusedFlow>
                          <Suspense fallback={<RouteLoading />}>
                            <AddTaskPage />
                          </Suspense>
                        </FocusedFlow>
                      </OrganizationStatusGate>
                    </OfflineProvider>
                  </ProtectedRoute>
                </Route>

                <Route>
                  <ProtectedShell />
                </Route>
              </Switch>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

export default App;
