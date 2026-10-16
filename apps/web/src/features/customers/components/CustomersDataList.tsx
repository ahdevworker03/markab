import { ChevronLeft, UserRound } from "lucide-react";
import type { CustomerResponse } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomersDataListProps {
  customers: CustomerResponse[];
  onOpen: (customerId: string) => void;
}

function CustomerIdentity({ customer }: { customer: CustomerResponse }) {
  const fullName = `${customer.firstName} ${customer.lastName}`.trim();

  return (
    <div className="flex min-w-0 items-start gap-3" dir="rtl">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UserRound className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 text-start">
        <span
          dir="auto"
          className="block break-words text-sm font-medium text-foreground"
        >
          {fullName}
        </span>
      </span>
    </div>
  );
}

function PhoneValue({ value }: { value: string }) {
  const westernDigits = value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const digitCode = digit.charCodeAt(0);
    const zeroCode = digitCode <= 0x0669 ? 0x0660 : 0x06f0;

    return String.fromCharCode(digitCode - zeroCode + 0x30);
  });

  return (
    <span
      dir="ltr"
      className="number-ltr block max-w-full break-all text-right text-sm font-medium text-foreground"
    >
      {westernDigits}
    </span>
  );
}

function LocationValue({ value }: { value: string }) {
  return (
    <div className="w-full text-right">
      <span
        dir="auto"
        className="inline-block max-w-full break-words text-sm text-foreground"
      >
        {value}
      </span>
    </div>
  );
}

export function CustomersDataList({
  customers,
  onOpen,
}: CustomersDataListProps) {
  return (
    <>
      <div className="hidden xl:block">
        <Table className="min-w-[62rem] table-fixed">
          <TableHeader className="bg-muted/45">
            <TableRow>
              <TableHead className="w-[20rem] min-w-[20rem]">العميل</TableHead>
              <TableHead className="w-[10rem] min-w-[10rem] text-start">
                رقم الهاتف
              </TableHead>
              <TableHead className="w-[20rem] min-w-[20rem] text-right">
                الموقع
              </TableHead>
              <TableHead className="w-[10rem] min-w-[10rem] text-end">
                الإجراء
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow
                key={customer.id}
                className="cursor-pointer"
                onClick={() => onOpen(customer.id)}
              >
                <TableCell className="min-w-[20rem]">
                  <CustomerIdentity customer={customer} />
                </TableCell>
                <TableCell className="min-w-[10rem] text-start">
                  <PhoneValue value={customer.phone} />
                </TableCell>
                <TableCell className="min-w-[20rem] text-start">
                  <LocationValue value={customer.address} />
                </TableCell>
                <TableCell className="min-w-[10rem] text-end whitespace-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(customer.id);
                    }}
                  >
                    عرض التفاصيل
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="hidden divide-y divide-border md:block xl:hidden">
        {customers.map((customer) => (
          <article key={customer.id} className="space-y-4 px-4 py-4 sm:px-5">
            <CustomerIdentity customer={customer} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="ui-label">الهاتف</div>
                <div className="mt-1">
                  <PhoneValue value={customer.phone} />
                </div>
              </div>
              <div className="min-w-0">
                <div className="ui-label">الموقع</div>
                <div className="mt-1">
                  <LocationValue value={customer.address} />
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpen(customer.id)}
              >
                عرض التفاصيل
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="divide-y divide-border md:hidden">
        {customers.map((customer) => (
          <article key={customer.id} className="space-y-4 px-4 py-4">
            <CustomerIdentity customer={customer} />
            <div className="grid min-w-0 grid-cols-[calc(50%-0.25rem)_7rem] items-start gap-2 rounded-lg bg-muted/45 p-3">
              <div className="min-w-0">
                <div className="ui-label">الهاتف</div>
                <div className="mt-1">
                  <PhoneValue value={customer.phone} />
                </div>
              </div>
              <div className="min-w-0 self-start">
                <div className="ui-label">الموقع</div>
                <div className="mt-1">
                  <LocationValue value={customer.address} />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpen(customer.id)}
              >
                التفاصيل
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function CustomersDataListSkeleton() {
  return (
    <div aria-label="جارٍ تحميل العملاء" className="space-y-0">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="grid grid-cols-4 gap-5 border-b border-border px-5 py-5 last:border-b-0"
        >
          <div className="h-9 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 animate-pulse rounded-md bg-muted" />
          <div className="h-5 animate-pulse rounded-md bg-muted" />
          <div className="h-8 animate-pulse rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}
