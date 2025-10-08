
"use client";

import Link from "next/link"
import * as React from "react"
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
import { getStudents, getClasses, getLatestInvoice, getSettings, generateAndDownloadBulkInvoices, createOrUpdateInvoice, getInvoiceForMonth, getInvoicesForStudent, getPayments } from "@/lib/data"
import type { Class, Student, StudentBill, Invoice } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Printer, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { getNepaliDate } from "@/lib/nepali-date"
import { generateBillsPdf } from "@/components/pdf-bill"

const NEPALI_MONTHS = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

interface ClassFeeSummary {
  class: Class;
  totalBilled: number;
  totalCollected: number;
  totalDues: number;
}

function PrintMonthlyBillsDialog({ classes, onActionComplete }: { classes: Class[]; onActionComplete: () => void; }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);

    const [selectedClassId, setSelectedClassId] = React.useState('');
    const [year, setYear] = React.useState(getNepaliDate(new Date()).year);
    const [month, setMonth] = React.useState(NEPALI_MONTHS[getNepaliDate(new Date()).monthIndex]);

    const [includeExamFee, setIncludeExamFee] = React.useState(false);
    const [includeRegFee, setIncludeRegFee] = React.useState(false);
    const [addExtraFee, setAddExtraFee] = React.useState(false);
    const [extraFeeName, setExtraFeeName] = React.useState('');
    const [extraFeeAmount, setExtraFeeAmount] = React.useState('');

    const handleGenerate = async () => {
        if (!selectedClassId) {
            toast({ variant: "destructive", title: "Error", description: "Please select a class." });
            return;
        }

        setIsLoading(true);
        try {
            const selectedClass = classes.find(c => c.id === selectedClassId);
            if (!selectedClass) throw new Error("Selected class not found.");
            
            const students = await getStudents({ classId: selectedClassId });
            const settings = await getSettings();

            const chargedFees: { feeType: string; amount: number }[] = [];
             // Always include monthly fee by default
            chargedFees.push({ feeType: 'monthly', amount: selectedClass.fees.monthly });

            if (includeExamFee) chargedFees.push({ feeType: 'exam', amount: selectedClass.fees.exam });
            if (includeRegFee) chargedFees.push({ feeType: 'registration', amount: selectedClass.fees.registration });
            if (addExtraFee && extraFeeName && extraFeeAmount) {
                chargedFees.push({ feeType: extraFeeName, amount: Number(extraFeeAmount) });
            }

            const bills: StudentBill[] = [];

            for (const student of students) {
                await createOrUpdateInvoice(student.id, selectedClassId, month, year, chargedFees, 0);
                const invoice = await getInvoiceForMonth(student.id, month, year);
                
                if (invoice) {
                    const previousDues = invoice.lineItems.find(li => li.feeType === 'Previous Dues')?.amount || 0;
                    bills.push({
                        school: settings,
                        student: student,
                        class: selectedClass,
                        invoice: invoice,
                        previousDues,
                    });
                }
            }
    
            if (bills.length > 0) {
              await generateBillsPdf(bills);
            } else {
               toast({ variant: "destructive", title: "No Bills", description: "No bills were generated for the selected class." });
            }

            toast({ title: "Success", description: `Bills for ${selectedClass.name} have been generated and downloaded.` });
            onActionComplete();
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "Failed to generate bills." });
        } finally {
            setIsLoading(false);
        }
    };
    
    const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Monthly Bills
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Generate and Print Monthly Bills</DialogTitle>
                    <DialogDescription>
                        Select a class and month to generate bills for all its students. The monthly fee is included by default.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2 col-span-3 sm:col-span-1">
                            <Label htmlFor="year">Year</Label>
                            <Input id="year" type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2 col-span-3 sm:col-span-2">
                             <Label htmlFor="month">Month</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger id="month">
                                    <SelectValue placeholder="Select Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {NEPALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="class">Class</Label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger id="class">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map(c => <SelectItem key={c.id} value={c.id}>{getDisplayName(c)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4 rounded-md border p-4">
                        <h4 className="text-sm font-medium">Optional Fees</h4>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="exam-fee" checked={includeExamFee} onCheckedChange={c => setIncludeExamFee(Boolean(c))} />
                            <Label htmlFor="exam-fee" className="font-normal">Include Exam Fee</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="reg-fee" checked={includeRegFee} onCheckedChange={c => setIncludeRegFee(Boolean(c))} />
                            <Label htmlFor="reg-fee" className="font-normal">Include Registration Fee</Label>
                        </div>
                    </div>

                     <div className="space-y-4 rounded-md border p-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">Add Extra Fee</h4>
                            <Switch checked={addExtraFee} onCheckedChange={setAddExtraFee} />
                        </div>
                        {addExtraFee && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                <Input placeholder="Fee Name" className="col-span-3 sm:col-span-2" value={extraFeeName} onChange={e => setExtraFeeName(e.target.value)} />
                                <Input placeholder="Amount" type="number" value={extraFeeAmount} onChange={e => setExtraFeeAmount(e.target.value)} />
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleGenerate} disabled={isLoading || !selectedClassId}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate & Download
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function AccountingPage() {
  const [feeSummaries, setFeeSummaries] = React.useState<ClassFeeSummary[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [loading, setLoading] = React.useState(true);

  const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
        // Fetch all data in parallel
        const [classesData, studentsData, allInvoicesData] = await Promise.all([
          getClasses(),
          getStudents(),
          getPayments() // This is a misnomer, it gets invoices with payments. A better name would be `getAllInvoices`
        ]);
        
        const allInvoices = allInvoicesData as unknown as Invoice[];
        setClasses(classesData);

        // Group students and invoices by classId for efficient lookup
        const studentsByClass = studentsData.reduce((acc, student) => {
            (acc[student.classId] = acc[student.classId] || []).push(student);
            return acc;
        }, {} as Record<string, Student[]>);

        const latestInvoicesByStudent = allInvoices.reduce((acc, invoice) => {
            if (!acc[invoice.studentId] || new Date(invoice.createdAt) > new Date(acc[invoice.studentId].createdAt)) {
                acc[invoice.studentId] = invoice;
            }
            return acc;
        }, {} as Record<string, Invoice>);


        const summaries: ClassFeeSummary[] = classesData.map(c => {
            const studentsInClass = studentsByClass[c.id] || [];
            let totalBilled = 0;
            let totalCollected = 0;
            let totalDues = 0;

            for (const student of studentsInClass) {
                const latestInvoice = latestInvoicesByStudent[student.id];
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
                totalBilled,
                totalCollected,
                totalDues,
            };
        });
        
        setFeeSummaries(summaries);
    } catch (error) {
        console.error("Failed to fetch accounting data:", error);
    } finally {
        setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <div>
      <PageHeader title="Accounting by Class">
        <PrintMonthlyBillsDialog classes={classes} onActionComplete={fetchData} />
      </PageHeader>
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
    

    