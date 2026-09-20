import { Router, type IRouter } from "express";
import {
  handlePhotoUpload,
  handleDocumentUpload,
  listPhotos,
  getPhoto,
  servePhoto,
  uploadPhoto,
  deletePhoto,
  listDocuments,
  getDocument,
  uploadDocument,
  deleteDocument,
  listCustomerDocuments,
  getCustomerDocument,
  uploadCustomerDocument,
  deleteCustomerDocument,
  updateVehicleDocument,
  updateCustomerDocument,
  downloadVehicleDocument,
  downloadCustomerDocument,
} from "./media.controller";
import {
  authenticate,
  createRateLimiter,
  requireOperationalOrganization,
  requireRole,
  validateUuidParam,
} from "../../middleware";
import { validateBody } from "../../middleware";
import { documentMetadataSchema } from "./media.validation";

const router: IRouter = Router();
const uploadRateLimit = () =>
  createRateLimiter({
    limit: 30,
    windowMs: 15 * 60 * 1000,
    key: (req) => `${req.user!.sub}:${req.user!.org}`,
  });
router.use(authenticate, requireOperationalOrganization);
router.param("vehicleId", validateUuidParam);
router.param("customerId", validateUuidParam);
router.param("id", validateUuidParam);

// Photos
router.get("/vehicles/:vehicleId/photos", listPhotos);
router.get("/vehicles/:vehicleId/photos/:id/serve", servePhoto);
router.get("/vehicles/:vehicleId/photos/:id", getPhoto);
router.post(
  "/vehicles/:vehicleId/photos",
  requireRole("OWNER"),
  uploadRateLimit(),
  handlePhotoUpload,
  uploadPhoto,
);
router.delete(
  "/vehicles/:vehicleId/photos/:id",
  requireRole("OWNER"),
  deletePhoto,
);

// Documents
router.get("/vehicles/:vehicleId/documents", listDocuments);
router.get("/vehicles/:vehicleId/documents/:id", getDocument);
router.patch(
  "/vehicles/:vehicleId/documents/:id",
  requireRole("OWNER"),
  validateBody(documentMetadataSchema),
  updateVehicleDocument,
);
router.get(
  "/vehicles/:vehicleId/documents/:id/download",
  downloadVehicleDocument,
);
router.post(
  "/vehicles/:vehicleId/documents",
  requireRole("OWNER"),
  uploadRateLimit(),
  handleDocumentUpload,
  uploadDocument,
);
router.delete(
  "/vehicles/:vehicleId/documents/:id",
  requireRole("OWNER"),
  deleteDocument,
);

// Customer documents
router.get("/customers/:customerId/documents", listCustomerDocuments);
router.get("/customers/:customerId/documents/:id", getCustomerDocument);
router.patch(
  "/customers/:customerId/documents/:id",
  requireRole("OWNER"),
  validateBody(documentMetadataSchema),
  updateCustomerDocument,
);
router.get(
  "/customers/:customerId/documents/:id/download",
  downloadCustomerDocument,
);
router.post(
  "/customers/:customerId/documents",
  requireRole("OWNER"),
  uploadRateLimit(),
  handleDocumentUpload,
  uploadCustomerDocument,
);
router.delete(
  "/customers/:customerId/documents/:id",
  requireRole("OWNER"),
  deleteCustomerDocument,
);

export default router;
