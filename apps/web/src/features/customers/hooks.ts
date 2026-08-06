import { customers, getCustomerById } from "@/data";
import type { Customer } from "@/data/types";

export function useCustomers(): Customer[] {
  return customers;
}

export function useCustomer(id: string): Customer | undefined {
  return getCustomerById(id);
}

export function useCustomerById(): (id: string) => Customer | undefined {
  return getCustomerById;
}
