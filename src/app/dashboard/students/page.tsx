

"use client"
import Link from "next/link"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getStudents, getClasses, addStudent } from "@/lib/data"
import { PlusCircle, Loader2, User as UserIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Student, Class } from "@/lib/types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"


function AddStudentDialog({ classes, onStudentAdded }: { classes: Class[], onStudentAdded: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function addStudentAction(formData: FormData) {
    setIsLoading(true);
    try {
      await addStudent(formData);
      toast({ title: "Success", description: "New student has been added." });
      onStudentAdded(); // Refresh data on parent
      formRef.current?.reset(); // Reset the form fields
      setIsOpen(false); // Close the dialog
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add student." });
    } finally {
      setIsLoading(false);
    }
  }
  
  const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={addStudentAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enroll a new student and assign them to a class. The student ID will be generated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="sm:text-right">
                Full Name
              </Label>
              <Input id="name" name="name" placeholder="John Doe" className="sm:col-span-3" required/>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="rollNumber" className="sm:text-right">
                Roll Number
              </Label>
              <Input id="rollNumber" name="rollNumber" type="number" placeholder="e.g., 12" className="sm:col-span-3" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="class" className="sm:text-right">
                Class
              </Label>
              <Select name="classId" required>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{getDisplayName(cls)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="sm:text-right">
                Address
              </Label>
              <Input id="address" name="address" placeholder="e.g., Kathmandu, Nepal" className="sm:col-span-3" />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="openingBalance" className="sm:text-right">
                Opening Balance
              </Label>
              <Input id="openingBalance" name="openingBalance" type="number" placeholder="Previous dues (if any)" className="sm:col-span-3" defaultValue={0} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <Label htmlFor="inTuition" className="sm:text-right">In Tuition?</Label>
                 <Checkbox id="inTuition" name="inTuition" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function StudentsPage() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
        const [studentsData, classesData] = await Promise.all([getStudents(), getClasses()]);
        setStudents(studentsData);
        setClasses(classesData);
    } catch (e) {
        console.error("Failed to fetch student data", e)
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

  const studentsByClass = classes.map(c => ({
    ...c,
    students: students.filter(s => s.classId === c.id)
  }));
  
  const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;


  return (
    <div>
      <PageHeader title="Students">
        <AddStudentDialog classes={classes} onStudentAdded={fetchData} />
      </PageHeader>

      <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={classes[0]?.id}>
         {studentsByClass.map(cls => (
             <AccordionItem value={cls.id} key={cls.id} className="rounded-lg border shadow-sm bg-card overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                     <div className="flex justify-between w-full pr-4">
                        <h3 className="text-lg font-medium">{getDisplayName(cls)}</h3>
                        <span className="text-muted-foreground">{cls.students.length} students</span>
                     </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Student ID</TableHead>
                                    <TableHead>Roll No.</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Address</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {cls.students.length > 0 ? cls.students.map((student) => (
                                <TableRow key={student.id} className="hover:bg-muted/50 cursor-pointer">
                                    <TableCell className="pl-6">
                                        <Link href={`/dashboard/students/${student.id}`} className="block w-full h-full">
                                            {student.sid}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/students/${student.id}`} className="block w-full h-full">
                                            {student.rollNumber}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                    <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback>
                                                <UserIcon/>
                                            </AvatarFallback>
                                        </Avatar>
                                        {student.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/students/${student.id}`} className="block w-full h-full">
                                            {student.address || '-'}
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No students in this class.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </AccordionContent>
             </AccordionItem>
         ))}
      </Accordion>
    </div>
  )
}
