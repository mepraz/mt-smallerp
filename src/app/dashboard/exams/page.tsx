
"use client"

import * as React from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { getExams, addExam } from "@/lib/data"
import { PlusCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import type { Exam } from "@/lib/types"
import { format } from 'date-fns'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { getNepaliDate } from "@/lib/nepali-date";

const NEPALI_MONTHS = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];


function AddExamDialog({ onExamAdded }: { onExamAdded: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const formRef = React.useRef<HTMLFormElement>(null);

  const formatNepaliDate = (gregorianDate: Date) => {
    const nepaliDate = getNepaliDate(new Date(gregorianDate));
    return `${NEPALI_MONTHS[nepaliDate.monthIndex]} ${nepaliDate.day}, ${nepaliDate.year}`;
  }

  async function addExamAction(formData: FormData) {
    setIsLoading(true);
    try {
      if (!date) {
        throw new Error("Date is required");
      }
      formData.append('date', date.toISOString());
      await addExam(formData);
      toast({ title: "Success", description: "New exam has been added." });
      onExamAdded();
      formRef.current?.reset();
      setDate(new Date());
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add exam." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Exam
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={addExamAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Add New Exam Term</DialogTitle>
            <DialogDescription>
              Create a new examination term, like "First Terminal Examination".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Exam Name</Label>
              <Input id="name" name="name" placeholder="e.g., First Terminal Examination" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Exam Date</Label>
               <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {date && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  Nepali Date: <span className="font-semibold">{formatNepaliDate(date)}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Exam
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


export default function ExamsPage() {
    const [exams, setExams] = React.useState<Exam[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const examsData = await getExams();
            setExams(examsData);
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatNepaliDate = (gregorianDate: Date) => {
        const nepaliDate = getNepaliDate(new Date(gregorianDate));
        return `${NEPALI_MONTHS[nepaliDate.monthIndex]} ${nepaliDate.day}, ${nepaliDate.year}`;
    }

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

  return (
    <div>
      <PageHeader title="Examinations">
        <AddExamDialog onExamAdded={fetchData} />
      </PageHeader>

      {/* Desktop View */}
      <div className="hidden md:block rounded-lg border shadow-sm bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam Name</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.name}</TableCell>
                  <TableCell className="text-right">
                    {formatNepaliDate(exam.date)}
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>

       {/* Mobile View */}
       <div className="md:hidden grid grid-cols-1 gap-4">
        {exams.map((exam) => (
            <Card key={exam.id}>
              <CardHeader>
                <CardTitle>{exam.name}</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium">{formatNepaliDate(exam.date)}</span>
                  </div>
              </CardContent>
            </Card>
          )
        )}
       </div>
    </div>
  )
}
