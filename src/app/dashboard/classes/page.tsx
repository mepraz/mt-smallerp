

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
import { getClasses, addClass, updateClass, updateClassFees } from "@/lib/data"
import { Edit, PlusCircle, Save, Loader2, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import type { Class, ClassFees } from "@/lib/types"

function AddClassDialog({ onClassAdded }: { onClassAdded: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function addClassAction(formData: FormData) {
    setIsLoading(true);
    try {
      await addClass(formData);
      toast({ title: "Success", description: "New class has been added." });
      onClassAdded();
      formRef.current?.reset();
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add class." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Class
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={addClassAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>
              Create a new class and section. You can manage detailed fees after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="sm:text-right">
                Class Name
              </Label>
              <Input id="name" name="name" placeholder="e.g., Class 11" className="sm:col-span-3" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="section" className="sm:text-right">
                Section
              </Label>
              <Input id="section" name="section" placeholder="e.g., A" className="sm:col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditClassDialog({ studentClass, onClassUpdated }: { studentClass: Class, onClassUpdated: () => void }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [name, setName] = React.useState(studentClass.name);
    const [section, setSection] = React.useState(studentClass.section);

    const handleUpdate = async () => {
        setIsLoading(true);
        try {
            await updateClass(studentClass.id, name, section);
            toast({ title: "Success", description: "Class updated successfully." });
            onClassUpdated();
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update class." });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Pencil className="h-4 w-4"/>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Class: {studentClass.name}{studentClass.section && ` - ${studentClass.section}`}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div>
                        <Label htmlFor="edit-name">Class Name</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="edit-section">Section</Label>
                        <Input id="edit-section" value={section} onChange={(e) => setSection(e.target.value)} />
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
    )
}


function ManageFeesDialog({ studentClass, onFeesUpdated }: { studentClass: Class, onFeesUpdated: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const feeTypes: { key: keyof ClassFees; label: string }[] = [
    { key: "registration", label: "Registration" },
    { key: "monthly", label: "Monthly" },
    { key: "exam", label: "Exam" },
    { key: "sports", label: "Game & Sports" },
    { key: "music", label: "Music/Culture" },
    { key: "medical", label: "Medical" },
    { key: "tuition", label: "Tuition" },
    { key: "stationery", label: "Stationery" },
    { key: "tieBelt", label: "Tie & Belt" },
  ];

  async function updateFeesAction(formData: FormData) {
    setIsLoading(true);
    try {
      const fees: Partial<ClassFees> = {};
      for (const { key } of feeTypes) {
        const value = formData.get(key);
        if (value) {
          fees[key] = Number(value);
        } else {
          fees[key] = 0; // Ensure fees are set to 0 if input is cleared
        }
      }
      await updateClassFees(studentClass.id, fees);
      toast({ title: "Success", description: "Fees updated successfully." });
      onFeesUpdated();
      setIsOpen(false);
    } catch(e) {
       console.error(e);
       toast({ variant: "destructive", title: "Error", description: "Failed to update fees." });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4"/>
            Manage Fees
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={updateFeesAction}>
          <DialogHeader>
            <DialogTitle>Manage Fees for {studentClass.name}{studentClass.section && ` - ${studentClass.section}`}</DialogTitle>
            <DialogDescription>
              Update the fee structure for this class.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            {feeTypes.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 items-center gap-4">
                <Label htmlFor={key} className="text-right">
                  {label}
                </Label>
                <Input
                  id={key}
                  name={key}
                  type="number"
                  placeholder="Amount"
                  defaultValue={studentClass.fees[key] || ''}
                  className="col-span-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Fees
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ClassesPage() {
    const [classes, setClasses] = React.useState<Class[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const classesData = await getClasses();
            setClasses(classesData);
        } catch (e) {
            console.error(e)
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
        )
    }

    const getDisplayName = (c: Class) => c.section ? `${c.name} - ${c.section}` : c.name;

  return (
    <div>
      <PageHeader title="Classes">
        <AddClassDialog onClassAdded={fetchData} />
      </PageHeader>

      {/* Desktop View */}
      <div className="hidden md:block rounded-lg border shadow-sm bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class Name</TableHead>
              <TableHead className="text-right">Total Fees</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((cls) => {
              const totalFees = Object.values(cls.fees).reduce((acc, fee) => acc + (fee || 0), 0);
              return (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {getDisplayName(cls)}
                    <EditClassDialog studentClass={cls} onClassUpdated={fetchData} />
                  </TableCell>
                  <TableCell className="text-right">
                    रु{totalFees.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <ManageFeesDialog studentClass={cls} onFeesUpdated={fetchData} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

       {/* Mobile View */}
       <div className="md:hidden grid grid-cols-1 gap-4">
        {classes.map((cls) => {
          const totalFees = Object.values(cls.fees).reduce((acc, fee) => acc + (fee || 0), 0);
          return (
            <Card key={cls.id}>
              <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{getDisplayName(cls)}</CardTitle>
                    <EditClassDialog studentClass={cls} onClassUpdated={fetchData} />
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Fees:</span>
                      <span className="font-medium">रु{totalFees.toLocaleString()}</span>
                  </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-4">
                 <ManageFeesDialog studentClass={cls} onFeesUpdated={fetchData} />
              </CardFooter>
            </Card>
          )
        })}
       </div>
    </div>
  )
}
