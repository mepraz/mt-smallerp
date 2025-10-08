

"use client";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { getClasses, getSubjects, getExams, addSubject, updateSubject, deleteSubject } from "@/lib/data"
import { PlusCircle, Save, Loader2, ChevronsRight, Pencil, Trash2 } from "lucide-react"
import type { Class, Subject, Exam } from "@/lib/types";
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { format } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox";


function EditSubjectDialog({ subject, onSubjectUpdated }: { subject: Subject; onSubjectUpdated: () => void; }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [name, setName] = React.useState(subject.name);
  const [code, setCode] = React.useState(subject.code);
  const [isExtra, setIsExtra] = React.useState(subject.isExtra);


  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      await updateSubject(subject.id, name, subject.fullMarksTheory, subject.fullMarksPractical, code, isExtra);
      toast({ title: "Success", description: "Subject updated successfully." });
      onSubjectUpdated();
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update subject." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
         <Button variant="outline" size="sm" className="h-7 w-7 p-0 md:h-auto md:w-auto md:px-3 md:py-1">
            <Pencil className="h-3 w-3 md:mr-2 md:h-4 md:w-4" />
            <span className="hidden md:inline">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Subject: {subject.name}</DialogTitle>
          <DialogDescription>Update the details for this subject.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
           <div>
            <Label htmlFor="subjectName">Subject Name</Label>
            <Input id="subjectName" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="subjectCode">Code</Label>
            <Input id="subjectCode" type="text" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="isExtra" checked={isExtra} onCheckedChange={(checked) => setIsExtra(Boolean(checked))} />
            <Label htmlFor="isExtra">Is Extra Subject</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleUpdate} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSubjectDialog({ subjectId, onSubjectDeleted }: { subjectId: string; onSubjectDeleted: () => void; }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  
  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await deleteSubject(subjectId);
      toast({ title: "Success", description: "Subject deleted successfully." });
      onSubjectDeleted();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete subject." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
     <AlertDialog>
        <AlertDialogTrigger asChild>
             <Button variant="destructive" size="sm" className="h-7 w-7 p-0 md:h-auto md:w-auto md:px-3 md:py-1">
                <Trash2 className="h-3 w-3 md:mr-2 md:h-4 md:w-4" />
                <span className="hidden md:inline">Delete</span>
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the subject and all associated result entries.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continue
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
     </AlertDialog>
  );
}


function ManageSubjects() {
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAdding, setIsAdding] = React.useState<Record<string, boolean>>({});

  const [newSubjectNames, setNewSubjectNames] = React.useState<Record<string, string>>({});
  const [newSubjectCodes, setNewSubjectCodes] = React.useState<Record<string, string>>({});
  const [newSubjectTheoryFm, setNewSubjectTheoryFm] = React.useState<Record<string, number | string>>({});
  const [newSubjectPracticalFm, setNewSubjectPracticalFm] = React.useState<Record<string, number | string>>({});
  const [newSubjectIsExtra, setNewSubjectIsExtra] = React.useState<Record<string, boolean>>({});

  
  const { toast } = useToast();

  const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [classesData, subjectsData] = await Promise.all([getClasses(), getSubjects()]);
      setClasses(classesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load data." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSubject = async (classId: string) => {
    const subjectName = newSubjectNames[classId];
    if (!subjectName) {
      toast({ variant: "destructive", title: "Validation Error", description: "Subject name cannot be empty." });
      return;
    }
    setIsAdding(prev => ({ ...prev, [classId]: true }));
    try {
      const code = newSubjectCodes[classId] || '';
      const theoryFm = Number(newSubjectTheoryFm[classId]) || 100;
      const practicalFm = Number(newSubjectPracticalFm[classId]) || 0;
      const isExtra = newSubjectIsExtra[classId] || false;

      await addSubject(classId, subjectName, theoryFm, practicalFm, code, isExtra);
      
      setNewSubjectNames(prev => ({ ...prev, [classId]: '' }));
      setNewSubjectCodes(prev => ({ ...prev, [classId]: '' }));
      setNewSubjectTheoryFm(prev => ({...prev, [classId]: ''}));
      setNewSubjectPracticalFm(prev => ({...prev, [classId]: ''}));
      setNewSubjectIsExtra(prev => ({...prev, [classId]: false}));

      toast({ title: "Success", description: "Subject added successfully." });
      fetchData(); // Refresh subjects list
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add subject." });
    } finally {
      setIsAdding(prev => ({ ...prev, [classId]: false }));
    }
  };


  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subjects per Class</CardTitle>
        <CardDescription>Add or view subjects for each class.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {classes.map(c => (
            <AccordionItem value={c.id} key={c.id}>
              <AccordionTrigger>{getDisplayName(c)}</AccordionTrigger>
              <AccordionContent className="space-y-4">
                {/* Desktop View */}
                <div className="hidden md:block">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Subject Name</TableHead>
                              <TableHead className="text-center">Extra Subject</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {subjects.filter(s => s.classId === c.id).map(s => (
                              <TableRow key={s.id}>
                                  <TableCell>{s.code}</TableCell>
                                  <TableCell>{s.name}</TableCell>
                                  <TableCell className="text-center">{s.isExtra ? 'Yes' : 'No'}</TableCell>
                                  <TableCell className="text-right space-x-2">
                                    <EditSubjectDialog subject={s} onSubjectUpdated={fetchData} />
                                    <DeleteSubjectDialog subjectId={s.id} onSubjectDeleted={fetchData} />
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                </div>
                
                {/* Mobile View */}
                <div className="md:hidden space-y-3">
                   {subjects.filter(s => s.classId === c.id).map(s => (
                       <Card key={s.id}>
                           <CardHeader className="flex flex-row items-start justify-between p-4">
                               <div>
                                  <CardTitle className="text-base">{s.name} ({s.code})</CardTitle>
                                   <div className="text-sm text-muted-foreground mt-2 space-y-1">
                                    <p>Extra Subject: {s.isExtra ? 'Yes' : 'No'}</p>
                                   </div>
                               </div>
                               <div className="flex gap-2">
                                  <EditSubjectDialog subject={s} onSubjectUpdated={fetchData} />
                                  <DeleteSubjectDialog subjectId={s.id} onSubjectDeleted={fetchData} />
                               </div>
                           </CardHeader>
                       </Card>
                   ))}
                </div>
                
                <div className="p-4 border-t space-y-3">
                    <h4 className="font-medium">Add New Subject</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-center">
                        <Input
                            placeholder="Subject Name"
                            value={newSubjectNames[c.id] || ''}
                            onChange={(e) => setNewSubjectNames(prev => ({ ...prev, [c.id]: e.target.value }))}
                        />
                        <Input
                            placeholder="Code"
                            value={newSubjectCodes[c.id] || ''}
                            onChange={(e) => setNewSubjectCodes(prev => ({ ...prev, [c.id]: e.target.value }))}
                        />
                         <Input
                            placeholder="Theory F.M."
                            type="number"
                            value={newSubjectTheoryFm[c.id] || ''}
                            onChange={(e) => setNewSubjectTheoryFm(prev => ({ ...prev, [c.id]: e.target.value }))}
                        />
                         <Input
                            placeholder="Practical F.M."
                             type="number"
                            value={newSubjectPracticalFm[c.id] || ''}
                            onChange={(e) => setNewSubjectPracticalFm(prev => ({ ...prev, [c.id]: e.target.value }))}
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`isExtra-${c.id}`}
                            checked={newSubjectIsExtra[c.id] || false}
                            onCheckedChange={(checked) => setNewSubjectIsExtra(prev => ({ ...prev, [c.id]: Boolean(checked) }))}
                          />
                          <Label htmlFor={`isExtra-${c.id}`}>Is Extra Subject</Label>
                        </div>
                    </div>
                     <Button variant="outline" onClick={() => handleAddSubject(c.id)} disabled={isAdding[c.id]}>
                        {isAdding[c.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Add Subject
                    </Button>
                </div>

              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}

function ExamsList() {
    const [exams, setExams] = React.useState<Exam[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        getExams().then(data => {
            setExams(data);
            setLoading(false);
        });
    }, []);

    if (loading) {
      return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Select an Examination</CardTitle>
          <CardDescription>Please choose an exam to enter or view results for.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
            {exams.map(exam => (
                 <Link href={`/dashboard/results/${exam.id}`} key={exam.id} className="block">
                    <Card className="hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">{exam.name}</CardTitle>
                                <CardDescription>{format(new Date(exam.date), 'PPP')}</CardDescription>
                            </div>
                            <ChevronsRight className="h-5 w-5 text-muted-foreground"/>
                        </CardHeader>
                    </Card>
                 </Link>
            ))}
            {exams.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    <p>No exams have been created yet.</p>
                    <p className="text-sm">Please go to the 'Exams' page to add a new examination term.</p>
                </div>
            )}
           </div>
        </CardContent>
      </Card>
    )
}


export default function ResultsPage() {

  return (
    <div>
      <PageHeader title="Result Management" />
      <Tabs defaultValue="enter-marks">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="enter-marks">Enter Marks</TabsTrigger>
          <TabsTrigger value="manage-subjects">Manage Subjects</TabsTrigger>
        </TabsList>
        <TabsContent value="enter-marks">
          <ExamsList />
        </TabsContent>
        <TabsContent value="manage-subjects">
          <ManageSubjects />
        </TabsContent>
      </Tabs>
    </div>
  )
}

    