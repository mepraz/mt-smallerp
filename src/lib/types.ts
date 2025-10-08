

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'accountant' | 'exam';
}


export interface Student {
  id: string;
  sid: string;
  name: string;
  rollNumber?: number;
  classId: string;
  address?: string;
  openingBalance?: number;
  inTuition?: boolean;
  dob?: string;
  totalAttendance?: number;
  presentAttendance?: number;
}

export interface ClassFees {
  registration: number;
  monthly: number;
  exam: number;
  sports: number;
  music: number;
  tuition: number;
  stationery: number;
  tieBelt: number;
  medical: number;
}

export interface Class {
  id: string;
  name:string;
  section: string;
  fees: ClassFees;
}

export interface PaymentTransaction {
    id: string;
    amount: number;
    date: Date | string;
}

export interface InvoiceLineItem {
  feeType: keyof Omit<ClassFees, 'medical'> | 'Medical' | 'Previous Dues' | string;
  amount: number;
}

export interface Invoice {
  id: string;
  studentId: string;
  classId: string;
  month: string; // e.g., "Baisakh"
  year: number; // e.g., 2081
  lineItems: InvoiceLineItem[];
  totalBilled: number;
  payments: PaymentTransaction[];
  totalPaid: number;
  balance: number;
  createdAt: Date;
}

export interface StudentFeeSummary {
  student: Student;
  class: Class;
  latestInvoice: Invoice | null;
  overallBalance: number;
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Overpaid';
}

export interface SchoolSettings {
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolLogoUrl?: string;
}

export interface StudentBill {
    school: SchoolSettings;
    student: Student;
    class: Class;
    invoice: Invoice;
    previousDues: number;
    payment?: { amount: number; date: Date | string };
  }

export interface ClassFeeSummary {
  class: Class;
  totalBilled: number;
  totalCollected: number;
  totalDues: number;
}

export interface Exam {
  id: string;
  name: string;
  date: Date;
}

export interface Subject {
    id: string;
    name: string;
    classId: string;
    fullMarksTheory: number;
    fullMarksPractical: number;
    code: string;
    isExtra: boolean;
}

export interface Result {
    id: string;
    examId: string;
    studentId: string;
    subjectId: string;
    theoryMarks: number;
    practicalMarks: number;
}


export interface StudentMarksheet {
  student: Student;
  class: Class;
  exam: Exam;
  results: (Result & Subject)[];
}

    