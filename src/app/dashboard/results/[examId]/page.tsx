

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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getClasses, getSubjects, getStudents, getResultsForExam, getSettings, addOrUpdateResult, getClassById, getExamById } from "@/lib/data"
import { Save, Loader2, Download, ArrowLeft } from "lucide-react"
import type { Class, Subject, Student, Result, StudentMarksheet, Exam } from "@/lib/types";
import { useToast } from "@/hooks/use-toast"
import { generateMarksheetPdf } from "@/components/pdf-marksheet"
import Link from "next/link"

interface ResultData {
  [studentId: string]: {
    [subjectId: string]: {
      theoryMarks: string | number;
      practicalMarks: string | number;
    }
  }
}

function EnterMarks({ exam } : { exam: Exam }) {
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [allStudents, setAllStudents] = React.useState<Student[]>([]);
  const [allSubjects, setAllSubjects] = React.useState<Subject[]>([]);
  
  const [selectedClassId, setSelectedClassId] = React.useState<string>('');
  
  const [studentsInClass, setStudentsInClass] = React.useState<Student[]>([]);
  const [subjectsForClass, setSubjectsForClass] = React.useState<Subject[]>([]);
  const [resultsData, setResultsData] = React.useState<ResultData>({});

  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const { toast } = useToast();

  const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [classesData, studentsData, subjectsData, resultsData] = await Promise.all([
        getClasses(),
        getStudents(),
        getSubjects(),
        getResultsForExam(exam.id),
      ]);
      setClasses(classesData);
      setAllStudents(studentsData);
      setAllSubjects(subjectsData);

      const newResults: ResultData = {};
      for (const student of studentsData) {
        newResults[student.id] = {};
        for (const subject of subjectsData) {
          const existingResult = resultsData.find(r => r.studentId === student.id && r.subjectId === subject.id);
          newResults[student.id][subject.id] = {
            theoryMarks: existingResult?.theoryMarks ?? '',
            practicalMarks: existingResult?.practicalMarks ?? '',
          };
        }
      }
      setResultsData(newResults);

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load initial data." });
    } finally {
      setLoading(false);
    }
  }, [toast, exam.id]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (selectedClassId) {
      setStudentsInClass(allStudents.filter(s => s.classId === selectedClassId));
      setSubjectsForClass(allSubjects.filter(s => s.classId === selectedClassId));
    } else {
      setStudentsInClass([]);
      setSubjectsForClass([]);
    }
  }, [selectedClassId, allStudents, allSubjects]);

  const handleMarksChange = (studentId: string, subjectId: string, type: 'theory' | 'practical', value: string) => {
    const marks = value; 
    setResultsData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: {
          ...prev[studentId]?.[subjectId],
          [type === 'theory' ? 'theoryMarks' : 'practicalMarks']: marks,
        }
      }
    }));
  }

  const handleSaveMarks = async () => {
    setIsSaving(true);
    try {
      for (const studentId in resultsData) {
        const studentResults = resultsData[studentId];
        for (const subjectId in studentResults) {
          const { theoryMarks, practicalMarks } = studentResults[subjectId];
          
          if(theoryMarks !== '' || practicalMarks !== '') {
            await addOrUpdateResult(exam.id, studentId, subjectId, Number(theoryMarks) || 0, Number(practicalMarks) || 0);
          }
        }
      }
      toast({ title: "Success", description: "Marks saved successfully." });
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save marks." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadResults = async () => {
    if (!selectedClassId) {
        toast({ variant: "destructive", title: "Error", description: "Please select a class first." });
        return;
    }
    setIsDownloading(true);
    try {
        const [schoolSettings, studentClass] = await Promise.all([getSettings(), getClassById(selectedClassId)]);
        if (!studentClass) throw new Error("Could not fetch class details.");

        const marksheets: StudentMarksheet[] = studentsInClass.map(student => {
            const resultsForStudent = subjectsForClass.map(subject => {
                const result = resultsData[student.id]?.[subject.id] || { theoryMarks: 0, practicalMarks: 0 };
                return {
                    subjectName: subject.name,
                    fullMarksTheory: subject.fullMarksTheory,
                    fullMarksPractical: subject.fullMarksPractical,
                    theoryMarks: Number(result.theoryMarks) || 0,
                    practicalMarks: Number(result.practicalMarks) || 0
                };
            });
            return {
                student,
                class: studentClass,
                exam,
                results: resultsForStudent,
            };
        });
        
        await generateMarksheetPdf(schoolSettings, marksheets);

    } catch(error) {
        console.error("Failed to generate marksheets:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not generate PDF marksheets." });
    } finally {
        setIsDownloading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Class Marks</CardTitle>
        <CardDescription>Select a class to enter marks in a spreadsheet-like view.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Select onValueChange={setSelectedClassId} value={selectedClassId}>
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{getDisplayName(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedClassId && subjectsForClass.length > 0 && (
            <div className="flex gap-2">
                <Button onClick={handleSaveMarks} disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save All Marks
                </Button>
                <Button onClick={handleDownloadResults} disabled={isDownloading} variant="outline" className="w-full sm:w-auto">
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download Results
                </Button>
            </div>
          )}
        </div>

        {loading && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        
        {!loading && selectedClassId && subjectsForClass.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No subjects found for this class.</p>
            <p className="text-sm">Please add subjects in the 'Manage Subjects' tab.</p>
          </div>
        )}

        {!loading && selectedClassId && subjectsForClass.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border">
                <Table className="min-w-full">
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="sticky left-0 bg-muted z-20 w-48 whitespace-nowrap">Student Name</TableHead>
                            {subjectsForClass.map(subject => (
                                <TableHead key={subject.id} className="text-center min-w-48 whitespace-nowrap">{subject.name}</TableHead>
                            ))}
                            <TableHead className="text-center">Total</TableHead>
                        </TableRow>
                        <TableRow>
                            <TableHead className="sticky left-0 bg-muted z-20"></TableHead>
                            {subjectsForClass.map(subject => (
                                <TableHead key={`${subject.id}-sub`} className="p-0">
                                    <div className="flex">
                                        <div className="w-1/2 text-center font-medium p-2 border-r">Theory (F.M. {subject.fullMarksTheory})</div>
                                        <div className="w-1/2 text-center font-medium p-2">Practical (F.M. {subject.fullMarksPractical})</div>
                                    </div>
                                </TableHead>
                            ))}
                             <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {studentsInClass.map(student => {
                             const totalMarks = subjectsForClass.reduce((acc, subject) => {
                                const result = resultsData[student.id]?.[subject.id] || { theoryMarks: 0, practicalMarks: 0 };
                                return acc + (Number(result.theoryMarks) || 0) + (Number(result.practicalMarks) || 0);
                            }, 0);

                            return (
                                <TableRow key={student.id}>
                                    <TableCell className="font-medium sticky left-0 bg-card z-10 whitespace-nowrap">{student.name}</TableCell>
                                    {subjectsForClass.map(subject => {
                                        const result = resultsData[student.id]?.[subject.id] || { theoryMarks: '', practicalMarks: '' };
                                        return (
                                            <TableCell key={subject.id} className="p-1">
                                                <div className="flex gap-1">
                                                    <Input type="number" placeholder="Th." value={result.theoryMarks} onChange={(e) => handleMarksChange(student.id, subject.id, 'theory', e.target.value)} className="text-center" />
                                                    <Input type="number" placeholder="Pr." value={result.practicalMarks} onChange={(e) => handleMarksChange(student.id, subject.id, 'practical', e.target.value)} className="text-center" />
                                                </div>
                                            </TableCell>
                                        )
                                    })}
                                    <TableCell className="text-center font-bold">{totalMarks}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <div className="md:hidden space-y-3">
                {studentsInClass.map(student => {
                    const totalMarks = subjectsForClass.reduce((acc, subject) => {
                        const result = resultsData[student.id]?.[subject.id] || { theoryMarks: 0, practicalMarks: 0 };
                        return acc + (Number(result.theoryMarks) || 0) + (Number(result.practicalMarks) || 0);
                    }, 0);

                    return (
                        <Card key={student.id}>
                            <Accordion type="single" collapsible>
                                <AccordionItem value={student.id} className="border-b-0">
                                    <AccordionTrigger className="p-4 hover:no-underline">
                                        <div className="flex justify-between w-full pr-4">
                                            <span className="font-semibold">{student.name}</span>
                                            <span className="text-muted-foreground font-normal">Total: {totalMarks}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <div className="space-y-4">
                                            {subjectsForClass.map(subject => {
                                                 const result = resultsData[student.id]?.[subject.id] || { theoryMarks: '', practicalMarks: '' };
                                                 return (
                                                     <div key={subject.id} className="p-3 border rounded-md">
                                                         <Label className="font-semibold">{subject.name}</Label>
                                                          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                                                              <div>
                                                                  <Label htmlFor={`theory-${student.id}-${subject.id}`} className="text-xs text-muted-foreground">Theory (F.M. {subject.fullMarksTheory})</Label>
                                                                  <Input id={`theory-${student.id}-${subject.id}`} type="number" placeholder="Marks" value={result.theoryMarks} onChange={(e) => handleMarksChange(student.id, subject.id, 'theory', e.target.value)} />
                                                              </div>
                                                               <div>
                                                                  <Label htmlFor={`practical-${student.id}-${subject.id}`} className="text-xs text-muted-foreground">Practical (F.M. {subject.fullMarksPractical})</Label>
                                                                  <Input id={`practical-${student.id}-${subject.id}`} type="number" placeholder="Marks" value={result.practicalMarks} onChange={(e) => handleMarksChange(student.id, subject.id, 'practical', e.target.value)} />
                                                              </div>
                                                          </div>
                                                     </div>
                                                 )
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </Card>
                    )
                })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}


export default function ExamResultsPage({ params }: { params: { examId: string } }) {
  const examId = React.use(params).examId;
  const [exam, setExam] = React.useState<Exam | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if(examId) {
        getExamById(examId)
        .then(setExam)
        .finally(() => setLoading(false));
    }
  }, [examId]);
  
  if (loading) {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
  }

  if(!exam) {
    return (
        <div className="text-center py-10">
            <p className="text-muted-foreground">Exam not found.</p>
             <Button asChild variant="link">
                <Link href="/dashboard/results">Go back to exams</Link>
            </Button>
        </div>
    )
  }


  return (
    <div>
      <PageHeader title={`Marks for ${exam.name}`}>
          <Button asChild variant="outline">
              <Link href="/dashboard/results">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Exams
              </Link>
          </Button>
      </PageHeader>
      <EnterMarks exam={exam} />
    </div>
  )
}
