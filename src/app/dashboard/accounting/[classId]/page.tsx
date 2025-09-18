
"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { getStudents, getClassById, getInvoiceForMonth, createOrUpdateInvoice, addPayment, getSettings, bulkCreateInvoices, checkInvoicesExistForMonth } from "@/lib/data"
import type { StudentFeeSummary, Class, Student, Invoice, ClassFees, StudentBill, ClassMonthlySummary, PaymentTransaction } from "@/lib/types"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, PlusCircle, Download, ArrowBigLeft, ArrowBigRight, Printer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/page-header"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateBillsPdf } from "@/components/pdf-bill"
import { generateBulkBillSlipsPdf } from "@/components/pdf-bulk-bill"
import { generateReceiptPdf } from "@/components/pdf-receipt"
import { getNepaliDate } from "@/lib/nepali-date";

const NEPALI_MONTHS = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

async function getFeeSummaryForClass(classId: string, month: string, year: number): Promise<{ summaries: StudentFeeSummary[], monthlySummary: ClassMonthlySummary }> {
    const [students, studentClass] = await Promise.all([
      getStudents({ classId }),
      getClassById(classId),
    ]);
  
    if (!studentClass) return { summaries: [], monthlySummary: { totalBilled: 0, totalCollected: 0, totalDues: 0 } };
    
    let totalBilledMonth = 0;
    let totalCollectedMonth = 0;
  
    const summaries = await Promise.all(students.map(async (student) => {
      const invoice = await getInvoiceForMonth(student.id, month, year);
      const latestInvoice = await getLatestInvoice(student.id);
      const overallBalance = latestInvoice ? latestInvoice.balance : (student.openingBalance || 0);

      
      let status: 'Paid' | 'Partial' | 'Unpaid' | 'Overpaid';

      if (!invoice) {
        status = 'Unpaid';
      } else if (overallBalance <= 0) {
        status = 'Paid';
        if (overallBalance < 0) {
            status = 'Overpaid';
        }
      } else if (invoice && invoice.totalPaid > 0) {
        status = 'Partial';
      } else {
        status = 'Unpaid';
      }

      if (invoice) {
        totalBilledMonth += invoice.lineItems.reduce((acc, item) => item.feeType !== 'Previous Dues' ? acc + item.amount : acc, 0);
        totalCollectedMonth += invoice.totalPaid;
      }
  
      return {
        student,
        class: studentClass,
        latestInvoice: invoice,
        totalPaidOverall: latestInvoice?.totalPaid || 0,
        overallBalance,
        status,
      };
    }));

    const totalDuesMonth = summaries.reduce((acc, s) => acc + s.overallBalance, 0);
    
    const monthlySummary = { totalBilled: totalBilledMonth, totalCollected: totalCollectedMonth, totalDues: totalDuesMonth };
  
    return { summaries, monthlySummary };
}


function ManageInvoiceDialog({ summary, onActionComplete, month, year }: { summary: StudentFeeSummary; onActionComplete: () => void; month: string, year: number }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState('');
  
  const studentClass = summary.class;
  const student = summary.student;

  const feeTypes = Object.keys(studentClass.fees).filter(f => f !== 'medical' && f !== 'tuition') as (keyof Omit<ClassFees, 'medical'|'tuition'>)[];
  const latestInvoice = summary.latestInvoice;

  async function handleGenerateInvoice(formData: FormData) {
    setIsLoading(true);
    try {
        const medicalFee = Number(formData.get('medical'));
        
        const chargedFees: { feeType: keyof ClassFees; amount: number }[] = [];
        for (const feeType of feeTypes) {
            if (formData.has(feeType)) {
                chargedFees.push({ feeType, amount: studentClass.fees[feeType] });
            }
        }
    
        await createOrUpdateInvoice(student.id, studentClass.id, month, year, chargedFees, medicalFee);
        
        toast({ title: "Success", description: "Invoice has been generated/updated." });
        onActionComplete();
        setIsOpen(false);
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to generate invoice." });
    } finally {
        setIsLoading(false);
    }
  }

  async function handlePaymentAction(print: boolean) {
    setIsLoading(true);
    try {
        const amount = Number(paymentAmount);
        if (!latestInvoice) {
            throw new Error("Cannot add payment without an invoice.");
        }
        const paymentRecord = await addPayment(student.id, latestInvoice.id, amount);
        toast({ title: "Success", description: "Payment recorded successfully." });

        if(print) {
            const settings = await getSettings();
            const previousDues = latestInvoice.lineItems.find(li => li.feeType === 'Previous Dues')?.amount || 0;
            const bill: StudentBill = {
                school: settings,
                student: summary.student,
                class: summary.class,
                invoice: { ...latestInvoice, balance: latestInvoice.balance - amount }, // Pass the updated balance
                previousDues,
                payment: paymentRecord,
            };
            await generateReceiptPdf(bill);
        }

        onActionComplete();
        setIsOpen(false);
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to record payment." });
    } finally {
        setIsLoading(false);
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" />
          Manage Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Invoice for {student.name}</DialogTitle>
          <DialogDescription>
            Generate/Update invoice for {month}, {year} or record a payment for this student.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            {/* --- Generate Invoice Form --- */}
            <form action={handleGenerateInvoice} className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Generate/Update Invoice</h3>
                <p className="text-sm text-muted-foreground">For: {month}, {year}</p>
                
                <div className="space-y-2">
                    <Label>Applicable Fees</Label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-48 overflow-y-auto rounded-md border p-4">
                        {student.inTuition && (
                            <div className="flex items-center space-x-2">
                                <Checkbox id={`individual-tuition`} name="tuition" defaultChecked={true} disabled/>
                                <Label htmlFor={`individual-tuition`} className="font-normal capitalize">Tuition</Label>
                           </div>
                        )}
                        {feeTypes.map(key => (
                           <div key={key} className="flex items-center space-x-2">
                             <Checkbox id={`individual-${key}`} name={key} defaultChecked={true}/>
                             <Label htmlFor={`individual-${key}`} className="font-normal capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                           </div>
                        ))}
                    </div>
                </div>
                 <div>
                    <Label htmlFor="medical">Medical Fee (NPR)</Label>
                    <Input id="medical" name="medical" type="number" placeholder="Enter amount if any" defaultValue={0}/>
                </div>

                <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {latestInvoice ? 'Update Invoice' : 'Generate Invoice'}
                    </Button>
                </DialogFooter>
            </form>

            {/* --- Record Payment Form --- */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Record Payment</h3>
                 <p className="text-sm text-muted-foreground">
                    {summary.latestInvoice ? `Current Balance: रु${summary.overallBalance.toLocaleString()}` : "No invoice found for this month. Please generate one first."}
                 </p>
                <div>
                    <Label htmlFor="amount">Amount Paid (NPR)</Label>
                    <Input id="amount" name="amount" type="number" placeholder="e.g., 5000" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </div>
                <DialogFooter>
                     <Button type="button" disabled={!summary.latestInvoice || isLoading || !paymentAmount} onClick={() => handlePaymentAction(true)} variant="outline">
                         {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                         <Printer className="mr-2 h-4 w-4"/>
                        Save & Print
                    </Button>
                    <Button type="button" disabled={!summary.latestInvoice || isLoading || !paymentAmount} onClick={() => handlePaymentAction(false)}>
                         {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Payment
                    </Button>
                </DialogFooter>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BulkInvoiceDialog({ 
  studentClass, 
  onActionComplete, 
  month, 
  year,
  isOpen,
  setIsOpen,
  onSuccessfulGeneration
} : { 
  studentClass: Class; 
  onActionComplete: () => void; 
  month: string, 
  year: number,
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  onSuccessfulGeneration: () => void
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const feeTypes = Object.keys(studentClass.fees).filter(f => f !== 'medical' && f !== 'tuition') as (keyof Omit<ClassFees, 'medical'|'tuition'>)[];
  
  async function handleBulkGenerate(formData: FormData) {
    setIsLoading(true);
    try {
      const chargedFees: { feeType: keyof ClassFees; amount: number }[] = [];
      for (const feeType of feeTypes) {
        if (formData.has(feeType)) {
          chargedFees.push({ feeType, amount: studentClass.fees[feeType] });
        }
      }
      
      const result = await bulkCreateInvoices(studentClass.id, month, year, chargedFees);
      toast({ title: "Success", description: `${result.created} invoices created and ${result.updated} invoices updated.` });
      onSuccessfulGeneration();
      onActionComplete();
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to bulk generate invoices." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <form action={handleBulkGenerate}>
          <DialogHeader>
            <DialogTitle>Generate Invoices for Next Month</DialogTitle>
            <DialogDescription>
              Generate invoices for all students in {studentClass.name}{studentClass.section && ` - ${studentClass.section}`} for the month of {month}, {year}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Select Fees to Apply to All Students</Label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto rounded-md border p-4">
              {feeTypes.map(key => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox id={`bulk-${key}`} name={key} defaultChecked={false} />
                  <Label htmlFor={`bulk-${key}`} className="font-normal capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate for All
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function DownloadBillButton({ summary }: { summary: StudentFeeSummary }) {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleDownload = async () => {
        if (!summary.latestInvoice || !summary.class) {
            toast({
                variant: "destructive",
                title: "No Invoice",
                description: "This student does not have an invoice to download for this month."
            });
            return;
        }
        setIsGenerating(true);
        try {
            const settings = await getSettings();
            const previousDues = summary.latestInvoice.lineItems.find(li => li.feeType === 'Previous Dues')?.amount || 0;
            const bill: StudentBill = {
                school: settings,
                student: summary.student,
                class: summary.class,
                invoice: summary.latestInvoice,
                previousDues,
            };
            await generateBillsPdf([bill]);
        } catch (error) {
            console.error("Failed to generate PDF bill:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not generate PDF." });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Bill
        </Button>
    );
}

export default function ClassAccountingPage({ params }: { params: { classId: string } }) {
  const classId = React.use(params).classId;
  const [summaries, setSummaries] = React.useState<StudentFeeSummary[]>([]);
  const [monthlySummary, setMonthlySummary] = React.useState<ClassMonthlySummary>({ totalBilled: 0, totalCollected: 0, totalDues: 0 });
  const [studentClass, setStudentClass] = React.useState<Class | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [isBulkInvoiceDialogOpen, setIsBulkInvoiceDialogOpen] = React.useState(false);
  const { toast } = useToast();
  
  const [currentDate, setCurrentDate] = React.useState(() => getNepaliDate(new Date()));

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
        const month = NEPALI_MONTHS[currentDate.monthIndex];
        const year = currentDate.year;
        const [ { summaries, monthlySummary }, sClass] = await Promise.all([
            getFeeSummaryForClass(classId, month, year),
            getClassById(classId)
        ]);
        setSummaries(summaries);
        setMonthlySummary(monthlySummary);
        setStudentClass(sClass);
    } catch (error) {
        console.error("Failed to fetch data", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch class accounting data." });
    } finally {
        setLoading(false);
    }
  }, [classId, currentDate, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handlePrevMonth = () => {
    setCurrentDate(prev => {
        let newMonthIndex = prev.monthIndex - 1;
        let newYear = prev.year;
        if (newMonthIndex < 0) {
            newMonthIndex = 11;
            newYear -= 1;
        }
        return { year: newYear, monthIndex: newMonthIndex, day: 1 };
    });
  };

  const proceedToNextMonth = () => {
    setCurrentDate(prev => {
        let newMonthIndex = prev.monthIndex + 1;
        let newYear = prev.year;
        if (newMonthIndex > 11) {
            newMonthIndex = 0;
            newYear += 1;
        }
        return { year: newYear, monthIndex: newMonthIndex, day: 1 };
    });
  };
  
  const handleNextMonth = async () => {
    const nextMonth = getNextMonth();
    const actualCurrentDate = getNepaliDate(new Date());

    const isNavigatingToFuture = nextMonth.year > actualCurrentDate.year || 
                               (nextMonth.year === actualCurrentDate.year && nextMonth.monthIndex > actualCurrentDate.monthIndex);
    
    if(isNavigatingToFuture) {
      // Check if invoices already exist for the next month
      const invoicesExist = await checkInvoicesExistForMonth(classId, NEPALI_MONTHS[nextMonth.monthIndex], nextMonth.year);
      if (invoicesExist) {
        proceedToNextMonth();
      } else {
        setIsBulkInvoiceDialogOpen(true);
      }
    } else {
      proceedToNextMonth();
    }
  };

  const getNextMonth = () => {
    let nextMonthIndex = currentDate.monthIndex + 1;
    let nextYear = currentDate.year;
    if (nextMonthIndex > 11) {
        nextMonthIndex = 0;
        nextYear += 1;
    }
    return { monthIndex: nextMonthIndex, year: nextYear };
  }

  const handleDownloadAllBills = async () => {
    setIsGeneratingPdf(true);
    try {
      const settings = await getSettings();
      const bills: StudentBill[] = [];

      for (const summary of summaries) {
        if (summary.latestInvoice && studentClass) {
          const previousDues = summary.latestInvoice.lineItems.find(li => li.feeType === 'Previous Dues')?.amount || 0;
          bills.push({
            school: settings,
            student: summary.student,
            class: studentClass,
            invoice: summary.latestInvoice,
            previousDues,
          });
        }
      }
      
      if (bills.length > 0) {
        await generateBulkBillSlipsPdf(bills);
      } else {
        toast({
            variant: "destructive",
            title: "No Invoices",
            description: "No students with generated invoices found for this month."
        })
      }

    } catch (error) {
      console.error("Failed to generate PDF bills:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not generate PDF." });
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  if (loading && !studentClass) {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  const title = studentClass ? `Accounting for ${studentClass.name}${studentClass.section ? ` - ${studentClass.section}`: ''}` : "Accounting";
  const nextMonthDate = getNextMonth();

  return (
    <div>
      <PageHeader title={title}>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadAllBills} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download All Bills
            </Button>
            <Button asChild variant="outline">
                <Link href="/dashboard/accounting">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Link>
            </Button>
        </div>
      </PageHeader>
      
      <div className="flex items-center justify-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ArrowBigLeft/></Button>
          <div className="text-xl font-bold text-center w-48">
              {NEPALI_MONTHS[currentDate.monthIndex]}, {currentDate.year}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}><ArrowBigRight/></Button>
      </div>

      {studentClass && (
        <BulkInvoiceDialog
          studentClass={studentClass}
          onActionComplete={fetchData}
          month={NEPALI_MONTHS[nextMonthDate.monthIndex]}
          year={nextMonthDate.year}
          isOpen={isBulkInvoiceDialogOpen}
          setIsOpen={setIsBulkInvoiceDialogOpen}
          onSuccessfulGeneration={proceedToNextMonth}
        />
      )}

      {loading ? (
        <div className="flex h-full w-full items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <>
        {/* Desktop View */}
        <div className="hidden md:block rounded-lg border shadow-sm bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead className="text-right">Total Billed</TableHead>
                <TableHead className="text-right">Paid Amount</TableHead>
                <TableHead className="text-right">Remaining Balance</TableHead>
                <TableHead className="text-right">Overpaid Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((summary) => (
                <TableRow key={summary.student.id}>
                  <TableCell className="font-medium">{summary.student.name}</TableCell>
                  <TableCell className="text-right">
                    रु{(summary.latestInvoice?.totalBilled ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                      रु{summary.totalPaidOverall.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                      रु{summary.overallBalance > 0 ? summary.overallBalance.toLocaleString() : 0}
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                      रु{summary.overallBalance < 0 ? Math.abs(summary.overallBalance).toLocaleString() : 0}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={
                      summary.status === 'Paid' ? 'default' : 
                      summary.status === 'Overpaid' ? 'default' :
                      summary.status === 'Partial' ? 'secondary' : 'destructive'
                    }
                    className={summary.status === 'Paid' ? 'bg-green-600 text-white' : summary.status === 'Overpaid' ? 'bg-blue-500 text-white' : ''}
                    >
                      {summary.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <DownloadBillButton summary={summary} />
                    <ManageInvoiceDialog summary={summary} onActionComplete={fetchData} month={NEPALI_MONTHS[currentDate.monthIndex]} year={currentDate.year} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
             <TableFooter>
                <TableRow className="bg-secondary hover:bg-secondary">
                    <TableHead className="font-bold">Class Total for {NEPALI_MONTHS[currentDate.monthIndex]}</TableHead>
                    <TableCell className="text-right font-bold">रु{monthlySummary.totalBilled.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-green-700">रु{monthlySummary.totalCollected.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-red-700">रु{monthlySummary.totalDues > 0 ? monthlySummary.totalDues.toLocaleString() : 0}</TableCell>
                     <TableCell className="text-right font-bold text-blue-700">रु{monthlySummary.totalDues < 0 ? Math.abs(monthlySummary.totalDues).toLocaleString() : 0}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                </TableRow>
             </TableFooter>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden grid grid-cols-1 gap-4">
          {summaries.map((summary) => (
            <Card key={summary.student.id}>
              <CardHeader>
                <CardTitle className="text-lg">{summary.student.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Billed:</span>
                      <span className="font-medium">रु{(summary.latestInvoice?.totalBilled ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid Amount:</span>
                      <span className="text-green-600 font-medium">रु{summary.totalPaidOverall.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Remaining Balance:</span>
                      <span className="text-red-600 font-medium">रु{summary.overallBalance > 0 ? summary.overallBalance.toLocaleString() : 0}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">Overpaid Amount:</span>
                      <span className="text-blue-600 font-medium">रु{summary.overallBalance < 0 ? Math.abs(summary.overallBalance).toLocaleString() : 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={
                        summary.status === 'Paid' ? 'default' : 
                        summary.status === 'Overpaid' ? 'default' :
                        summary.status === 'Partial' ? 'secondary' : 'destructive'
                      }
                      className={summary.status === 'Paid' ? 'bg-green-600 text-white' : summary.status === 'Overpaid' ? 'bg-blue-500 text-white' : ''}
                      >
                        {summary.status}
                      </Badge>
                  </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-4 space-x-2">
                  <DownloadBillButton summary={summary} />
                  <ManageInvoiceDialog summary={summary} onActionComplete={fetchData} month={NEPALI_MONTHS[currentDate.monthIndex]} year={currentDate.year}/>
              </CardFooter>
            </Card>
          ))}
        </div>
         <Card className="mt-6 md:hidden">
            <CardHeader>
                <CardTitle>Class Summary for {NEPALI_MONTHS[currentDate.monthIndex]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Billed:</span>
                    <span className="font-medium">रु{monthlySummary.totalBilled.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Collected:</span>
                    <span className="font-medium text-green-700">रु{monthlySummary.totalCollected.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Dues:</span>
                    <span className="font-medium text-red-700">रु{monthlySummary.totalDues > 0 ? monthlySummary.totalDues.toLocaleString() : 0 }</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Overpaid:</span>
                    <span className="font-medium text-blue-700">रु{monthlySummary.totalDues < 0 ? Math.abs(monthlySummary.totalDues).toLocaleString() : 0 }</span>
                </div>
            </CardContent>
         </Card>
      </>
      )}
    </div>
  )
}
