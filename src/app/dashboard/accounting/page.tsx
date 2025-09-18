import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getStudents, getClasses, getLatestInvoice } from "@/lib/data"
import type { Class, Student } from "@/lib/types"

interface ClassFeeSummary {
  class: Class;
  totalBilled: number;
  totalCollected: number;
  totalDues: number;
}

async function getFeeSummaries(): Promise<ClassFeeSummary[]> {
  const classes = await getClasses();
  const summaries = await Promise.all(classes.map(async (c) => {
    const studentsInClass = await getStudents({ classId: c.id });
    let totalBilled = 0;
    let totalCollected = 0;
    let totalDues = 0;

    for (const student of studentsInClass) {
      const latestInvoice = await getLatestInvoice(student.id);
      if (latestInvoice) {
        totalBilled += latestInvoice.totalBilled;
        totalCollected += latestInvoice.totalPaid;
        totalDues += latestInvoice.balance;
      } else {
        totalDues += student.openingBalance || 0;
      }
    }

    return {
      class: c,
      totalBilled: totalBilled,
      totalCollected,
      totalDues,
    };
  }));

  return summaries;
}


export default async function AccountingPage() {
  const feeSummaries = await getFeeSummaries();

  const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;

  return (
    <div>
      <PageHeader title="Accounting by Class" />
      {/* Desktop View */}
      <div className="hidden md:block rounded-lg border shadow-sm bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Total Billed</TableHead>
              <TableHead className="text-right">Total Collected</TableHead>
              <TableHead className="text-right">Total Dues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeSummaries.map((summary) => (
              <TableRow key={summary.class.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <Link href={`/dashboard/accounting/${summary.class.id}`} className="block">
                    {getDisplayName(summary.class)}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/dashboard/accounting/${summary.class.id}`} className="block">
                    रु{summary.totalBilled.toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell className="text-right text-green-600">
                  <Link href={`/dashboard/accounting/${summary.class.id}`} className="block">
                    रु{summary.totalCollected.toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell className="text-right text-red-600">
                   <Link href={`/dashboard/accounting/${summary.class.id}`} className="block">
                    रु{summary.totalDues.toLocaleString()}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile View */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {feeSummaries.map((summary) => (
          <Link href={`/dashboard/accounting/${summary.class.id}`} key={summary.class.id}>
            <Card className="cursor-pointer hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">{getDisplayName(summary.class)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Billed:</span>
                      <span>रु{summary.totalBilled.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Collected:</span>
                      <span className="text-green-600">रु{summary.totalCollected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Dues:</span>
                      <span className="text-red-600">रु{summary.totalDues.toLocaleString()}</span>
                  </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
