import type { Request, Response, NextFunction } from "express";
import {
  getOrganization,
  getPlatformOrganization,
  listPlatformOrganizations,
  listPlatformOrganizationUsers,
  updateOrganization,
  updateOrganizationStatus,
  deleteOrganization,
} from "./organization.service";
import { ok, noContent } from "../../shared";
import type {
  ListPlatformOrganizationsQuery,
  UpdateOrganizationInput,
  UpdateOrganizationStatusInput,
} from "./organization.validation";

async function get(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const org = await getOrganization(req.user!.org);
    ok(res, org);
  } catch (err) {
    next(err);
  }
}

async function update(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as UpdateOrganizationInput;
    const org = await updateOrganization(req.user!.org, input);
    ok(res, org);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as UpdateOrganizationStatusInput;
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;
    const org = await updateOrganizationStatus(
      organizationId,
      req.user!.sub,
      input.status,
      input.reason,
    );
    ok(res, org);
  } catch (err) {
    next(err);
  }
}

async function listPlatform(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const organizations = await listPlatformOrganizations(
      res.locals.validatedQuery as ListPlatformOrganizationsQuery,
    );
    res.status(200).json(organizations);
  } catch (err) {
    next(err);
  }
}

async function getPlatform(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const organizationId = req.params.organizationId as string;
    const org = await getPlatformOrganization(organizationId);
    ok(res, org);
  } catch (err) {
    next(err);
  }
}

async function listPlatformUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const organizationId = req.params.organizationId as string;
    ok(res, await listPlatformOrganizationUsers(organizationId));
  } catch (err) {
    next(err);
  }
}

async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteOrganization(req.user!.org);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export {
  get,
  update,
  updateStatus,
  listPlatform,
  getPlatform,
  listPlatformUsers,
  remove,
};
