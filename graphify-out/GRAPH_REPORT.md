# Graph Report - markab  (2026-09-17)

## Corpus Check
- 640 files · ~439,274 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3899 nodes · 9503 edges · 165 communities (149 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 182 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Rental Operations
- Maintenance Operations
- Vehicle Fleet
- Rental Operations
- Maintenance Operations
- Customer Management
- Task Management
- Authentication
- Rental Operations
- Rental Operations
- Web Components
- Maintenance Operations
- Authentication
- Maintenance Operations
- Vehicle Fleet
- Authentication
- Community 16
- Vehicle Fleet
- Vehicle Fleet
- Maintenance Operations
- Generated API Client
- Maintenance Operations
- Maintenance Operations
- Maintenance Operations
- Organization Management
- Authentication
- Maintenance Operations
- Vehicle Fleet
- Rental Operations
- Maintenance Operations
- Organization Management
- Vehicle Fleet
- Customer Management
- Web Layout
- Maintenance Operations
- Rental Operations
- Authentication
- Authentication
- Maintenance Operations
- Vehicle Fleet
- Generated API Client
- Community 41
- Web Components
- Vehicle Fleet
- Maintenance Operations
- Rental Operations
- Rental Operations
- Vehicle Fleet
- Authentication
- Community 49
- Authentication
- Community 51
- Rental Operations
- Vehicle Fleet
- Authentication
- Web Components
- Maintenance Operations
- Vehicle Fleet
- Maintenance Operations
- Task Management
- Maintenance Operations
- Vehicle Fleet
- Customer Management
- Rental Operations
- Vehicle Fleet
- Vehicle Fleet
- Web Components
- Organization Management
- Web Components
- Vehicle Fleet
- Vehicle Fleet
- Web Components
- Community 72
- Organization Management
- Community 74
- Authentication
- Vehicle Fleet
- Web Components
- Web Components
- Vehicle Fleet
- Rental Operations
- Community 81
- Database Layer
- Maintenance Operations
- Maintenance Operations
- Authentication
- Web Components
- Web Components
- Community 88
- Community 89
- Generated API Client
- Web Components
- Vehicle Fleet
- Vehicle Fleet
- Community 94
- Web Components
- Community 96
- Maintenance Operations
- Maintenance Operations
- Rental Operations
- Vehicle Fleet
- Community 101
- Community 102
- Community 103
- Community 104
- Maintenance Operations
- Payments
- Authentication
- Maintenance Operations
- Task Management
- Community 110
- Authentication
- Web Components
- Web Components
- Web Components
- Customer Management
- Rental Operations
- Task Management
- Community 118
- Vehicle Fleet
- Rental Contracts
- Rental Operations
- Vehicle Fleet
- Vehicle Fleet
- Community 124
- Community 125
- Rental Operations
- Vehicle Fleet
- Maintenance Operations
- Community 129
- Rental Operations
- Authentication
- Community 132
- Maintenance Operations
- Customer Management
- Community 135
- Maintenance Operations
- Community 137
- Web Layout
- Task Management
- Authentication
- Authentication
- Authentication
- Authentication
- Authentication
- Authentication
- Authentication
- Task Management
- Task Management
- Task Management
- Authentication
- Rental Contracts
- Community 152
- Task Management
- Community 154
- Community 155
- Rental Operations
- Community 157
- Task Management
- Community 159
- Community 160
- Community 161

## God Nodes (most connected - your core abstractions)
1. `cn()` - 369 edges
2. `AppError` - 135 edges
3. `customFetch()` - 121 edges
4. `getApiErrorMessage()` - 101 edges
5. `lucide-react` - 81 edges
6. `ok()` - 69 edges
7. `useAuth()` - 45 edges
8. `Button` - 43 edges
9. `prisma` - 42 edges
10. `express` - 38 edges

## Surprising Connections (you probably didn't know these)
- `VehicleStatusBadgeProps` --references--> `VehicleResponseStatus`  [EXTRACTED]
  apps/web/src/features/vehicles/components/VehicleStatusBadge.tsx → lib/api-client-react/src/generated/api.schemas.ts
- `AccountPage()` --calls--> `useGetMyOrganization()`  [EXTRACTED]
  apps/web/src/features/account/pages/AccountPage.tsx → lib/api-client-react/src/generated/organizations/organizations.ts
- `submit()` --calls--> `acceptEmployeeInvitation()`  [EXTRACTED]
  apps/web/src/features/auth/pages/AcceptInvitationPage.tsx → lib/api-client-react/src/generated/auth/auth.ts
- `submit()` --calls--> `confirmPasswordReset()`  [EXTRACTED]
  apps/web/src/features/auth/pages/PasswordResetPage.tsx → lib/api-client-react/src/generated/auth/auth.ts
- `submit()` --calls--> `requestPasswordReset()`  [EXTRACTED]
  apps/web/src/features/auth/pages/PasswordResetPage.tsx → lib/api-client-react/src/generated/auth/auth.ts

## Import Cycles
- None detected.

## Communities (165 total, 13 thin omitted)

### Community 0 - "Rental Operations"
Cohesion: 0.03
Nodes (83): FocusedFlow(), FocusedFlowProps, PageActionArea(), PageActionAreaProps, AccordionContent, AccordionItem, AccordionTrigger, Avatar (+75 more)

### Community 1 - "Maintenance Operations"
Cohesion: 0.03
Nodes (87): useMaintenanceForVehicle(), useMaintenanceScheduleMutations(), CompleteMaintenanceRequest, CreateMaintenanceScheduleRequest, ListMaintenanceParams, MaintenanceListResponse, MaintenanceScheduleListResponse, MaintenanceScheduleResponseWrapper (+79 more)

### Community 2 - "Vehicle Fleet"
Cohesion: 0.03
Nodes (87): CreateVehicleRequest, ListAvailableVehiclesParams, PhotoListResponse, PhotoResponseWrapper, UpdateVehicleRequest, UploadVehiclePhotoBody, VehicleListResponse, VehicleResponseWrapper (+79 more)

### Community 3 - "Rental Operations"
Cohesion: 0.04
Nodes (82): useRentalContract(), useRentalContractSignedDocuments(), ContractResponseWrapper, UploadRentalContractSignedDocumentBody, Awaited, AwaitedInput, deleteRentalContract(), DeleteRentalContractMutationError (+74 more)

### Community 4 - "Maintenance Operations"
Cohesion: 0.06
Nodes (55): Button, DatePicker(), DatePickerProps, parseDateOnly(), toDateOnly(), EmptyState(), EmptyStateProps, ErrorStateProps (+47 more)

### Community 5 - "Customer Management"
Cohesion: 0.04
Nodes (74): useCustomerMutations(), CreateCustomerRequest, CustomerListResponse, CustomerResponseWrapper, DocumentListResponse, DocumentResponseWrapper, ListCustomersParams, UpdateCustomerRequest (+66 more)

### Community 6 - "Task Management"
Cohesion: 0.06
Nodes (57): complete(), create(), get(), list(), remove(), update(), beirutBusinessDate(), beirutDateTimeToInstant() (+49 more)

### Community 7 - "Authentication"
Cohesion: 0.03
Nodes (69): devDependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, esbuild-wasm, @esbuild/win32-x64 (+61 more)

### Community 8 - "Rental Operations"
Cohesion: 0.07
Nodes (47): deleteSigned(), downloadSigned(), generate(), get(), getSigned(), handleUpload(), listSigned(), pdf() (+39 more)

### Community 9 - "Rental Operations"
Cohesion: 0.04
Nodes (67): CheckRentalAvailabilityParams, CreateRentalRequest, ExtendRentalRequest, ListRentalsParams, PickupRentalRequest, RentalAvailabilityResponse, RentalListResponse, RentalResponseWrapper (+59 more)

### Community 10 - "Web Components"
Cohesion: 0.03
Nodes (54): dependencies, @workspace/api-client-react, @workspace/api-zod, react, @tanstack/react-query, @types/node, vitest, @workspace/api-zod (+46 more)

### Community 11 - "Maintenance Operations"
Cohesion: 0.04
Nodes (32): AcceptEmployeeInvitationRequest, CheckRentalAvailabilityParams, CompleteMaintenanceRequest, ConfirmPasswordResetRequest, CreateCustomerRequest, CreateEmployeeInvitationRequest, CreatePaymentRequest, CreatePaymentRequestMethod (+24 more)

### Community 12 - "Authentication"
Cohesion: 0.05
Nodes (45): ProtectedRoute(), ProtectedRouteProps, AccountPage(), save(), sendInvite(), AcceptInvitationPage(), submit(), LoginPage() (+37 more)

### Community 13 - "Maintenance Operations"
Cohesion: 0.06
Nodes (44): ARABIC_WEEKDAY_NAMES, Calendar(), CalendarDayButton(), CustomerCard(), CustomerCardProps, CustomersDataListProps, ExpenseCard(), daysLabelFor() (+36 more)

### Community 14 - "Vehicle Fleet"
Cohesion: 0.06
Nodes (41): PendingDocument, useAvailableVehicles(), useRentalsForVehicle(), useVehicleMutations(), useVehicleRecord(), fieldClass(), VehicleFormFields(), VehicleFormFieldsProps (+33 more)

### Community 15 - "Authentication"
Cohesion: 0.09
Nodes (40): InlineFeedback(), FormField(), FormFieldProps, inputClass, FormState, INITIAL, task(), TaskRecurrenceFields() (+32 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (26): DEFAULT_CORS_ORIGINS, env, EnvConfig, loadEnv(), LogLevel, NodeEnv, parseCorsOrigins(), R2Config (+18 more)

### Community 17 - "Vehicle Fleet"
Cohesion: 0.07
Nodes (33): StatusBadge(), StatusBadgeProps, statusMap, StatusTone, StatusType, toneClass, Table, TableBody (+25 more)

### Community 18 - "Vehicle Fleet"
Cohesion: 0.09
Nodes (40): create(), get(), list(), remove(), update(), create(), softDelete(), update() (+32 more)

### Community 19 - "Maintenance Operations"
Cohesion: 0.06
Nodes (39): requireOperationalOrganization(), errorHandler(), notFoundHandler(), validateBody(), validateParams(), validateQuery(), router, router (+31 more)

### Community 20 - "Generated API Client"
Cohesion: 0.06
Nodes (50): CreateEmployeeInvitationRequest, CreateUserRequest, EmployeeInvitationResponseWrapper, UpdateUserRequest, UserListResponse, UserResponseWrapper, Awaited, AwaitedInput (+42 more)

### Community 21 - "Maintenance Operations"
Cohesion: 0.07
Nodes (34): DetailSection(), DetailSectionProps, SectionCardProps, SummaryActionPanel(), SummaryActionPanelProps, ExpenseCategoryBadge(), AmountValue(), DateValue() (+26 more)

### Community 22 - "Maintenance Operations"
Cohesion: 0.04
Nodes (48): AuthTokens, ContractResponse, CreateExpenseRequestCategory, CreateMaintenanceRequest, CreateMaintenanceRequestType, CreateMaintenanceScheduleRequestMaintenanceType, CreateMaintenanceScheduleRequestScheduleType, CreatePaymentRequestMethod (+40 more)

### Community 23 - "Maintenance Operations"
Cohesion: 0.09
Nodes (31): SectionCard(), AnalyticsPage(), ActiveRentalRow(), AlertTone, DashboardPage(), dueLabelFor(), getMetricState(), RecentActivityRow() (+23 more)

### Community 24 - "Organization Management"
Cohesion: 0.06
Nodes (42): organizationStatusContent, OrganizationStatusGate(), OrganizationStatusGateProps, { useGetMyOrganization }, BodyType, ErrorResponse, OrganizationResponseWrapper, UpdateOrganizationRequest (+34 more)

### Community 25 - "Authentication"
Cohesion: 0.08
Nodes (41): confirmReset(), currentUser(), loginHandler(), logout(), refresh(), requestReset(), verifyPassword(), getCurrentUser() (+33 more)

### Community 26 - "Maintenance Operations"
Cohesion: 0.17
Nodes (13): app, generateAccessToken(), createCustomer(), customerPayload(), expectMissingFile(), removeStoredObject(), createVehicle(), vehiclePayload() (+5 more)

### Community 27 - "Vehicle Fleet"
Cohesion: 0.12
Nodes (41): toDocumentResponse(), toPhotoResponse(), deleteCustomerDocument(), deleteVehicleDocument(), deleteVehiclePhoto(), downloadCustomerDocument(), DownloadResult, downloadVehicleDocument() (+33 more)

### Community 28 - "Rental Operations"
Cohesion: 0.07
Nodes (35): mockedUseAuth, mockedUsePaymentMutations, mockedUseRentalPayments, usePaymentMutations(), useRentalPayments(), RentalOutstandingBalance, CreatePaymentRequest, PaymentListResponse (+27 more)

### Community 29 - "Maintenance Operations"
Cohesion: 0.08
Nodes (33): BottomNavigation(), NavTab(), LogoutButton(), account, ALL_NAVIGATION_ITEMS, analytics, customers, dashboard (+25 more)

### Community 30 - "Organization Management"
Cohesion: 0.11
Nodes (28): get(), remove(), update(), updateStatus(), DbClient, softDelete(), update(), updateStatusWithinTx() (+20 more)

### Community 31 - "Vehicle Fleet"
Cohesion: 0.05
Nodes (39): createVehicleBodyCurrentMileageMin, createVehicleBodyYearMax, createVehicleBodyYearMin, CreateVehicleResponse, DeleteVehicleDocumentParams, DeleteVehicleDocumentResponse, DeleteVehicleParams, DeleteVehiclePhotoParams (+31 more)

### Community 32 - "Customer Management"
Cohesion: 0.12
Nodes (27): create(), get(), list(), remove(), update(), create(), softDelete(), update() (+19 more)

### Community 33 - "Web Layout"
Cohesion: 0.08
Nodes (34): AppShell(), AppShellProps, AppSidebar(), AppSidebarLink(), PageContainer(), PageContainerProps, Sidebar(), SidebarContent() (+26 more)

### Community 34 - "Maintenance Operations"
Cohesion: 0.13
Nodes (26): DashboardPeriod, deriveDashboardData(), getCurrentDashboardPeriod(), getDaysFromCurrentDay(), now, toUtcDay(), buildReportSummary(), BusinessPerformancePoint (+18 more)

### Community 35 - "Rental Operations"
Cohesion: 0.08
Nodes (25): ErrorState(), PaymentSection(), handleSubmit(), validate(), PaymentSectionProps, toISO(), Action, actionCopy() (+17 more)

### Community 36 - "Authentication"
Cohesion: 0.10
Nodes (26): FilterChips(), FilterChipsProps, FilterOption, COMPLETED_STYLES, OVERDUE_STYLES, PENDING_STYLES, TaskCard(), TaskCardProps (+18 more)

### Community 37 - "Authentication"
Cohesion: 0.06
Nodes (35): AcceptEmployeeInvitationRequest, AuthTokensResponse, ConfirmPasswordResetRequest, CurrentUserResponseWrapper, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest (+27 more)

### Community 38 - "Maintenance Operations"
Cohesion: 0.16
Nodes (30): retrySerializable(), complete(), create(), get(), list(), listByVehicle(), remove(), update() (+22 more)

### Community 39 - "Vehicle Fleet"
Cohesion: 0.11
Nodes (25): customers, getActiveRentals(), getCustomerById(), getRentalById(), getRentalsForCustomer(), getRentalsForVehicle(), getTotalPaid(), getTotalRemaining() (+17 more)

### Community 40 - "Generated API Client"
Cohesion: 0.07
Nodes (34): CreateExpenseRequest, ExpenseListResponse, ExpenseResponseWrapper, ListExpensesParams, UpdateExpenseRequest, Awaited, AwaitedInput, createExpense() (+26 more)

### Community 41 - "Community 41"
Cohesion: 0.14
Nodes (24): create(), get(), list(), remove(), update(), create(), softDelete(), update() (+16 more)

### Community 42 - "Web Components"
Cohesion: 0.07
Nodes (30): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+22 more)

### Community 43 - "Vehicle Fleet"
Cohesion: 0.10
Nodes (24): VehicleStatus, ANALYTICS_MONTHS, ANALYTICS_YEARS, AnalyticsPeriodOption, AnalyticsPeriodSelect(), AnalyticsVehicle, deriveAnalytics(), MetricCard() (+16 more)

### Community 44 - "Maintenance Operations"
Cohesion: 0.09
Nodes (27): Basis, empty, Form, fromSchedule(), MaintenanceScheduleManager(), remove(), save(), toggle() (+19 more)

### Community 45 - "Rental Operations"
Cohesion: 0.10
Nodes (20): PageHeader(), PageHeaderProps, InlineError(), LoadingState(), useCustomerRecord(), CustomerFormFields(), CustomerFormFieldsProps, CustomerFormState (+12 more)

### Community 46 - "Rental Operations"
Cohesion: 0.14
Nodes (20): requireRole(), create(), list(), listByRental(), create(), router, assertValidAmount(), assertValidMethod() (+12 more)

### Community 47 - "Vehicle Fleet"
Cohesion: 0.16
Nodes (28): deleteCustomerDocument(), deleteDocument(), deletePhoto(), downloadCustomerDocument(), downloadVehicleDocument(), getCustomerDocument(), getDocument(), getPhoto() (+20 more)

### Community 48 - "Authentication"
Cohesion: 0.14
Nodes (23): authenticate(), authConfig, register(), isUserRole(), userRoles, verifyAccessToken(), deleteRefreshToken(), findRefreshToken() (+15 more)

### Community 49 - "Community 49"
Cohesion: 0.07
Nodes (28): @prisma/client, @types/node, vitest, @workspace/api-zod, zod, name, private, type (+20 more)

### Community 50 - "Authentication"
Cohesion: 0.14
Nodes (26): applyBaseUrl(), AuthRefreshHandler, AuthTokenGetter, buildErrorMessage(), customFetch(), CustomFetchOptions, getMediaType(), getStringField() (+18 more)

### Community 51 - "Community 51"
Cohesion: 0.07
Nodes (28): dependencies, @prisma/adapter-pg, @prisma/client, zod, devDependencies, dotenv-cli, prisma, tsx (+20 more)

### Community 52 - "Rental Operations"
Cohesion: 0.07
Nodes (25): GetRentalContractParams, getRentalContractParamsSchema, DeleteRentalContractParams, DeleteRentalContractResponse, DeleteRentalContractSignedDocumentParams, DeleteRentalContractSignedDocumentResponse, DownloadRentalContractSignedDocumentParams, DownloadRentalContractSignedDocumentResponse (+17 more)

### Community 53 - "Vehicle Fleet"
Cohesion: 0.10
Nodes (9): mediaService, CreateDocumentInput, CreatePhotoInput, DocumentCategory, DocumentRecord, DocumentResponse, PhotoRecord, PhotoResponse (+1 more)

### Community 54 - "Authentication"
Cohesion: 0.09
Nodes (22): Alert, AlertDescription, AlertTitle, alertVariants, Badge(), BadgeProps, badgeVariants, Empty() (+14 more)

### Community 55 - "Web Components"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 56 - "Maintenance Operations"
Cohesion: 0.07
Nodes (26): completeMaintenanceBodyCostMin, CompleteMaintenanceParams, CompleteMaintenanceResponse, createMaintenanceBodyCostMin, createMaintenanceBodyReplacedPartsItemUnitCostMin, CreateMaintenanceResponse, CreateMaintenanceScheduleBody, createMaintenanceScheduleBodyNextDueMileageMin (+18 more)

### Community 57 - "Vehicle Fleet"
Cohesion: 0.14
Nodes (25): transaction(), availability(), cancel(), create(), extend(), get(), list(), pickup() (+17 more)

### Community 58 - "Maintenance Operations"
Cohesion: 0.13
Nodes (18): MaintenanceCardProps, CostValue(), DateValue(), dueLabel(), MaintenanceDataList(), MaintenanceDataListProps, MaintenanceDataListSkeleton(), MaintenanceListItem (+10 more)

### Community 59 - "Task Management"
Cohesion: 0.09
Nodes (25): CreateTaskRequest, TaskListResponse, TaskResponseWrapper, UpdateTaskRequest, Awaited, AwaitedInput, CompleteTaskMutationError, CompleteTaskMutationResult (+17 more)

### Community 60 - "Maintenance Operations"
Cohesion: 0.19
Nodes (22): create(), get(), list(), remove(), update(), assertScheduleBasis(), createMaintenanceSchedule(), deleteMaintenanceSchedule() (+14 more)

### Community 61 - "Vehicle Fleet"
Cohesion: 0.10
Nodes (12): AvailableVehicleRow, create(), createWithinTx(), DbClient, softDeleteWithinTx(), update(), updateVehicleStatus(), updateVehicleStatusWithinTx() (+4 more)

### Community 62 - "Customer Management"
Cohesion: 0.08
Nodes (24): CreateCustomerBody, CreateCustomerResponse, DeleteCustomerDocumentParams, DeleteCustomerDocumentResponse, DeleteCustomerParams, DeleteCustomerResponse, DownloadCustomerDocumentParams, DownloadCustomerDocumentResponse (+16 more)

### Community 63 - "Rental Operations"
Cohesion: 0.08
Nodes (24): CancelRentalParams, CancelRentalResponse, CheckRentalAvailabilityResponse, createRentalBodyDailyRateMin, createRentalBodyDepositAmountMin, createRentalBodyTotalAmountMin, CreateRentalResponse, DeleteRentalParams (+16 more)

### Community 64 - "Vehicle Fleet"
Cohesion: 0.16
Nodes (21): availability(), create(), get(), list(), remove(), update(), deleteVehicle(), listAvailableVehicles() (+13 more)

### Community 65 - "Vehicle Fleet"
Cohesion: 0.14
Nodes (17): calcDays(), NewRentalPage(), clearError(), handleSave(), selectCustomer(), selectVehicle(), validate(), toDateInput() (+9 more)

### Community 66 - "Web Components"
Cohesion: 0.11
Nodes (19): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+11 more)

### Community 67 - "Organization Management"
Cohesion: 0.19
Nodes (10): CurrentUserResponse, CurrentUserResponseWrapper, OrganizationResponse, OrganizationResponseWrapper, OrganizationStatus, UpdateOrganizationStatusRequest, UserListResponse, UserResponse (+2 more)

### Community 68 - "Web Components"
Cohesion: 0.12
Nodes (16): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut() (+8 more)

### Community 69 - "Vehicle Fleet"
Cohesion: 0.18
Nodes (18): useCustomerDocuments(), useVehiclePhotos(), downloadCustomerDocument(), getDeleteCustomerDocumentMutationOptions(), getDownloadCustomerDocumentUrl(), getListCustomerDocumentsQueryKey(), getListCustomerDocumentsQueryOptions(), getUpdateCustomerDocumentMutationOptions() (+10 more)

### Community 70 - "Vehicle Fleet"
Cohesion: 0.12
Nodes (19): useVehicleDocuments(), deleteVehicleDocument(), downloadVehicleDocument(), getDeleteVehicleDocumentMutationOptions(), getDeleteVehicleDocumentUrl(), getDownloadVehicleDocumentQueryKey(), getDownloadVehicleDocumentQueryOptions(), getDownloadVehicleDocumentUrl() (+11 more)

### Community 71 - "Web Components"
Cohesion: 0.11
Nodes (12): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+4 more)

### Community 72 - "Community 72"
Cohesion: 0.12
Nodes (17): dependencies, argon2, @aws-sdk/client-s3, cookie-parser, cors, dotenv, drizzle-orm, express (+9 more)

### Community 73 - "Organization Management"
Cohesion: 0.20
Nodes (8): create(), AuditAction, AuditMetadata, AuditTargetType, CreateAuditLogInput, create(), DbClient, TransactionClient

### Community 74 - "Community 74"
Cohesion: 0.27
Nodes (14): recordAuditLog(), accept(), create(), acceptEmployeeInvitation(), run(), createEmployeeInvitation(), createToken(), emailAlreadyExistsError() (+6 more)

### Community 75 - "Authentication"
Cohesion: 0.21
Nodes (13): hashPassword(), clearPasswordResetDeliveriesForTest(), deliverPasswordReset(), getLatestPasswordResetDeliveryForTest(), PasswordResetDelivery, testDeliveries, requestReset(), confirmPasswordReset() (+5 more)

### Community 76 - "Vehicle Fleet"
Cohesion: 0.31
Nodes (12): AvailableVehicleResponse, toAvailableVehicleResponse(), assertPatchDoesNotChangeStatus(), assertRentalCanBeAmended(), assertValidAmounts(), assertValidPeriod(), checkAvailability(), listAvailableVehicles() (+4 more)

### Community 77 - "Web Components"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 78 - "Web Components"
Cohesion: 0.17
Nodes (14): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+6 more)

### Community 79 - "Vehicle Fleet"
Cohesion: 0.17
Nodes (10): ExpenseCardProps, ExpenseCategoryBadgeProps, ExpenseListItem, ExpenseDisplayFilter, filterExpenses(), getExpenseTotal(), getExpenseTotalForPeriod(), getNetProfit() (+2 more)

### Community 80 - "Rental Operations"
Cohesion: 0.24
Nodes (14): checkAvailabilityQuerySchema, createRentalSchema, extendRentalSchema, listRentalsQuerySchema, pickupRentalSchema, returnRentalSchema, updateRentalSchema, CheckRentalAvailabilityQueryParams (+6 more)

### Community 81 - "Community 81"
Cohesion: 0.13
Nodes (15): devDependencies, esbuild, esbuild-plugin-pino, pino-pretty, supertest, thread-stream, @types/cookie-parser, @types/cors (+7 more)

### Community 82 - "Database Layer"
Cohesion: 0.16
Nodes (7): isForeignKeyError(), isNotFoundError(), isTransactionConflictError(), connect(), disconnect(), TransactionOptions, adapter

### Community 83 - "Maintenance Operations"
Cohesion: 0.18
Nodes (6): create(), DbClient, softDeleteWithinTx(), update(), updateVehicleStatusWithinTx(), updateWithinTx()

### Community 84 - "Maintenance Operations"
Cohesion: 0.23
Nodes (13): businessDate, createMaintenanceScheduleSchema, deleteMaintenanceScheduleParamsSchema, getMaintenanceScheduleParamsSchema, listMaintenanceSchedulesQuerySchema, maintenanceType, scheduleType, updateMaintenanceScheduleParamsSchema (+5 more)

### Community 85 - "Authentication"
Cohesion: 0.23
Nodes (12): App(), configureApiClient(), clearTokens(), getAccessToken(), getRefreshToken(), setTokens(), AuthProvider(), restoreSession() (+4 more)

### Community 86 - "Web Components"
Cohesion: 0.17
Nodes (14): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+6 more)

### Community 87 - "Web Components"
Cohesion: 0.19
Nodes (11): SegmentedControl(), SegmentedControlProps, OPTIONS, monthOptions(), PERIOD_TYPE_OPTIONS, PeriodSelector(), PeriodSelectorProps, QUARTER_LABELS (+3 more)

### Community 88 - "Community 88"
Cohesion: 0.14
Nodes (13): apiClientReactSrc, apiZodSrc, root, titleTransformer(), zodTransformer(), devDependencies, orval, name (+5 more)

### Community 89 - "Community 89"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, jsx, lib, moduleResolution, noEmit, paths, resolveJsonModule (+5 more)

### Community 90 - "Generated API Client"
Cohesion: 0.20
Nodes (13): ErrorType, HealthStatus, Awaited, AwaitedInput, getHealthCheckQueryKey(), getHealthCheckQueryOptions(), getHealthCheckUrl(), healthCheck() (+5 more)

### Community 91 - "Web Components"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 92 - "Vehicle Fleet"
Cohesion: 0.17
Nodes (11): AddVehiclePage(), handleSubmit(), validate(), create, setLocation, uploadDocument, uploadPhoto, getUploadVehicleDocumentMutationOptions() (+3 more)

### Community 93 - "Vehicle Fleet"
Cohesion: 0.39
Nodes (9): isUniqueConstraintError(), AvailableVehicleResponse, createVehicle(), getVehicle(), toResponse(), updateVehicle(), CreateVehicleInput, UpdateVehicleInput (+1 more)

### Community 94 - "Community 94"
Cohesion: 0.17
Nodes (11): compilerOptions, incremental, outDir, rootDir, tsBuildInfoFile, types, exclude, extends (+3 more)

### Community 95 - "Web Components"
Cohesion: 0.23
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload(), THEMES (+2 more)

### Community 96 - "Community 96"
Cohesion: 0.17
Nodes (11): dependencies, @tanstack/react-query, exports, react, @tanstack/react-query, name, peerDependencies, react (+3 more)

### Community 97 - "Maintenance Operations"
Cohesion: 0.32
Nodes (6): CreateMaintenanceRequest, CreateMaintenanceRequestType, MaintenanceReplacedPart, UpdateMaintenanceRequest, UpdateMaintenanceRequestStatus, UpdateMaintenanceRequestType

### Community 98 - "Maintenance Operations"
Cohesion: 0.32
Nodes (6): MaintenanceListResponse, MaintenanceResponse, MaintenanceResponseReplacedPartsItem, MaintenanceResponseStatus, MaintenanceResponseType, MaintenanceResponseWrapper

### Community 99 - "Rental Operations"
Cohesion: 0.30
Nodes (6): PaymentListResponse, PaymentResponse, PaymentResponseMethod, PaymentResponseWrapper, RentalPaymentsResponse, RentalPaymentsResponseData

### Community 100 - "Vehicle Fleet"
Cohesion: 0.32
Nodes (6): VehicleListResponse, VehicleResponse, VehicleResponseFuelType, VehicleResponseStatus, VehicleResponseTransmission, VehicleResponseWrapper

### Community 101 - "Community 101"
Cohesion: 0.27
Nodes (8): applyTheme(), getStoredTheme(), ThemeProbe(), Theme, ThemeContext, ThemeContextValue, ThemeProvider(), useTheme()

### Community 102 - "Community 102"
Cohesion: 0.18
Nodes (10): compilerOptions, composite, declarationMap, emitDeclarationOnly, lib, outDir, rootDir, extends (+2 more)

### Community 103 - "Community 103"
Cohesion: 0.18
Nodes (10): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, types, extends (+2 more)

### Community 104 - "Community 104"
Cohesion: 0.20
Nodes (10): scripts, build, dev, dev:api, format, format:check, lint, start (+2 more)

### Community 105 - "Maintenance Operations"
Cohesion: 0.38
Nodes (8): completeMaintenanceSchema, createMaintenanceSchema, listMaintenanceQuerySchema, updateMaintenanceSchema, CompleteMaintenanceBody, CreateMaintenanceBody, ListMaintenanceQueryParams, UpdateMaintenanceBody

### Community 106 - "Payments"
Cohesion: 0.24
Nodes (7): makeApiError(), enterDueDate(), makeApiError(), mockedUseTaskMutations, selectDate(), makeApiError(), ApiError

### Community 107 - "Authentication"
Cohesion: 0.20
Nodes (4): mockedUseAuth, mockedUseTask, mockedUseTaskMutations, setLocationMock

### Community 108 - "Maintenance Operations"
Cohesion: 0.38
Nodes (5): MaintenanceScheduleListResponse, MaintenanceScheduleResponse, MaintenanceScheduleResponseMaintenanceType, MaintenanceScheduleResponseScheduleType, MaintenanceScheduleResponseWrapper

### Community 109 - "Task Management"
Cohesion: 0.38
Nodes (5): TaskListResponse, TaskResponse, TaskResponseRecurrenceUnit, TaskResponseStatus, TaskResponseWrapper

### Community 110 - "Community 110"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, extends, include (+1 more)

### Community 112 - "Web Components"
Cohesion: 0.28
Nodes (7): NotFound(), Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 113 - "Web Components"
Cohesion: 0.22
Nodes (7): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle, vaul

### Community 114 - "Web Components"
Cohesion: 0.25
Nodes (8): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport, @radix-ui/react-navigation-menu

### Community 115 - "Customer Management"
Cohesion: 0.25
Nodes (8): AddCustomerPage(), handleSubmit(), validate(), isValidDate(), getUploadCustomerDocumentMutationOptions(), getUploadCustomerDocumentUrl(), uploadCustomerDocument(), useUploadCustomerDocument()

### Community 116 - "Rental Operations"
Cohesion: 0.33
Nodes (4): getActiveRentals(), getEndedRentals(), getRemaining(), getTotalPaid()

### Community 117 - "Task Management"
Cohesion: 0.22
Nodes (9): useTask(), useTasksList(), getGetTaskQueryKey(), getGetTaskQueryOptions(), getGetTaskUrl(), getTask(), useGetTask(), useListTasks() (+1 more)

### Community 118 - "Community 118"
Cohesion: 0.22
Nodes (8): dependencies, zod, exports, zod, name, private, type, version

### Community 119 - "Vehicle Fleet"
Cohesion: 0.36
Nodes (4): create(), softDelete(), update(), VehicleRecord

### Community 120 - "Rental Contracts"
Cohesion: 0.29
Nodes (8): ContractSection(), handleDeleteDocument(), handleDownloadDocument(), handleDownloadPdf(), handleFileChange(), handleGenerate(), handlePrintable(), triggerDownload()

### Community 121 - "Rental Operations"
Cohesion: 0.29
Nodes (6): RentalCardProps, RentalHistorySectionProps, RentalListItem, RentalsDataList(), rental, RentalResponse

### Community 122 - "Vehicle Fleet"
Cohesion: 0.29
Nodes (6): create, customer, selectDate(), setLocation, setValidPeriod(), vehicle

### Community 123 - "Vehicle Fleet"
Cohesion: 0.46
Nodes (4): CreateVehicleRequest, CreateVehicleRequestFuelType, CreateVehicleRequestStatus, CreateVehicleRequestTransmission

### Community 124 - "Community 124"
Cohesion: 0.46
Nodes (4): DocumentListResponse, DocumentResponse, DocumentResponseCategory, DocumentResponseWrapper

### Community 125 - "Community 125"
Cohesion: 0.46
Nodes (4): ExpenseListResponse, ExpenseResponse, ExpenseResponseCategory, ExpenseResponseWrapper

### Community 126 - "Rental Operations"
Cohesion: 0.46
Nodes (4): RentalListResponse, RentalResponse, RentalResponseStatus, RentalResponseWrapper

### Community 127 - "Vehicle Fleet"
Cohesion: 0.46
Nodes (4): UpdateVehicleRequest, UpdateVehicleRequestFuelType, UpdateVehicleRequestStatus, UpdateVehicleRequestTransmission

### Community 128 - "Maintenance Operations"
Cohesion: 0.43
Nodes (3): create(), softDelete(), update()

### Community 129 - "Community 129"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:web, serve, test, typecheck

### Community 130 - "Rental Operations"
Cohesion: 0.29
Nodes (6): createPaymentBodyAmountExclusiveMin, CreatePaymentParams, CreatePaymentResponse, ListPaymentsResponse, ListRentalPaymentsParams, ListRentalPaymentsResponse

### Community 131 - "Authentication"
Cohesion: 0.33
Nodes (6): RegisterPage(), submit(), getRegisterOrganizationMutationOptions(), getRegisterOrganizationUrl(), registerOrganization(), useRegisterOrganization()

### Community 132 - "Community 132"
Cohesion: 0.47
Nodes (4): daysFromToday(), MOCK_TODAY, MOCK_TODAY_STR, toISO()

### Community 133 - "Maintenance Operations"
Cohesion: 0.60
Nodes (3): CreateMaintenanceScheduleRequest, CreateMaintenanceScheduleRequestMaintenanceType, CreateMaintenanceScheduleRequestScheduleType

### Community 134 - "Customer Management"
Cohesion: 0.60
Nodes (3): CustomerListResponse, CustomerResponse, CustomerResponseWrapper

### Community 135 - "Community 135"
Cohesion: 0.60
Nodes (3): EmployeeInvitationResponse, EmployeeInvitationResponseRole, EmployeeInvitationResponseWrapper

### Community 136 - "Maintenance Operations"
Cohesion: 0.60
Nodes (3): UpdateMaintenanceScheduleRequest, UpdateMaintenanceScheduleRequestMaintenanceType, UpdateMaintenanceScheduleRequestScheduleType

### Community 137 - "Community 137"
Cohesion: 0.40
Nodes (3): artifactDir, esbuild, esbuild-plugin-pino

### Community 138 - "Web Layout"
Cohesion: 0.40
Nodes (4): ContentGrid(), ContentGridProps, ContentGridVariant, gridVariants

### Community 139 - "Task Management"
Cohesion: 0.40
Nodes (5): useTaskMutations(), completeTask(), getCompleteTaskMutationOptions(), getCompleteTaskUrl(), useCompleteTask()

### Community 140 - "Authentication"
Cohesion: 0.50
Nodes (4): acceptEmployeeInvitation(), getAcceptEmployeeInvitationMutationOptions(), getAcceptEmployeeInvitationUrl(), useAcceptEmployeeInvitation()

### Community 141 - "Authentication"
Cohesion: 0.50
Nodes (4): confirmPasswordReset(), getConfirmPasswordResetMutationOptions(), getConfirmPasswordResetUrl(), useConfirmPasswordReset()

### Community 142 - "Authentication"
Cohesion: 0.50
Nodes (4): getGetCurrentUserQueryKey(), getGetCurrentUserQueryOptions(), useGetCurrentUser(), withQueryKey()

### Community 143 - "Authentication"
Cohesion: 0.50
Nodes (4): getLoginMutationOptions(), getLoginUrl(), login(), useLogin()

### Community 144 - "Authentication"
Cohesion: 0.50
Nodes (4): getLogoutMutationOptions(), getLogoutUrl(), logout(), useLogout()

### Community 145 - "Authentication"
Cohesion: 0.50
Nodes (4): getRefreshTokenMutationOptions(), getRefreshTokenUrl(), refreshToken(), useRefreshToken()

### Community 146 - "Authentication"
Cohesion: 0.50
Nodes (4): getRequestPasswordResetMutationOptions(), getRequestPasswordResetUrl(), requestPasswordReset(), useRequestPasswordReset()

### Community 147 - "Task Management"
Cohesion: 0.50
Nodes (4): deleteTask(), getDeleteTaskMutationOptions(), getDeleteTaskUrl(), useDeleteTask()

### Community 148 - "Task Management"
Cohesion: 0.50
Nodes (4): getListTasksQueryKey(), getListTasksQueryOptions(), getListTasksUrl(), listTasks()

### Community 149 - "Task Management"
Cohesion: 0.50
Nodes (4): getUpdateTaskMutationOptions(), getUpdateTaskUrl(), updateTask(), useUpdateTask()

## Knowledge Gaps
- **1053 isolated node(s):** `artifactDir`, `name`, `version`, `private`, `type` (+1048 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1291 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `VehicleAvailabilitySection()` connect `Maintenance Operations` to `Vehicle Fleet`, `Authentication`, `Vehicle Fleet`?**
  _High betweenness centrality (0.439) - this node is a cross-community bridge._
- **Why does `handleSubmit()` connect `Vehicle Fleet` to `Maintenance Operations`?**
  _High betweenness centrality (0.439) - this node is a cross-community bridge._
- **Why does `pickup()` connect `Vehicle Fleet` to `Rental Operations`, `Vehicle Fleet`?**
  _High betweenness centrality (0.439) - this node is a cross-community bridge._
- **What connects `artifactDir`, `name`, `version` to the rest of the system?**
  _1053 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rental Operations` be split into smaller, more focused modules?**
  _Cohesion score 0.030867792661619105 - nodes in this community are weakly interconnected._
- **Should `Maintenance Operations` be split into smaller, more focused modules?**
  _Cohesion score 0.03265412748171369 - nodes in this community are weakly interconnected._
- **Should `Vehicle Fleet` be split into smaller, more focused modules?**
  _Cohesion score 0.029258098223615466 - nodes in this community are weakly interconnected._