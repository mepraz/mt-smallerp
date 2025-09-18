

"use server";

import { Db, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { Class, Student, Subject, Result, ClassFees, Invoice, InvoiceLineItem, SchoolSettings, Exam, User, PaymentTransaction } from '@/lib/types';
import { redirect } from 'next/navigation';
import { getSession, sessionOptions } from './session';
import { cookies } from 'next/headers';
import * as bcrypt from 'bcrypt';

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}


// --- Auth Management ---
export async function authenticate(prevState: string | undefined, formData: FormData) {
    try {
        const { username, password } = Object.fromEntries(formData);
        const db = await getDb();
        const user = await db.collection('users').findOne({ username: username as string });

        if (!user) {
            return 'Invalid credentials.';
        }

        const passwordsMatch = await bcrypt.compare(password as string, user.passwordHash);

        if (!passwordsMatch) {
            return 'Invalid credentials.';
        }

        const session = await getSession();
        session.isLoggedIn = true;
        session.username = user.username;
        session.role = user.role;
        await session.save();

    } catch (error) {
        if ((error as Error).message.includes('credentialssignin')) {
            return 'Invalid credentials.';
        }
        console.error('Authentication error:', error);
        return 'An unexpected error occurred.';
    }
    redirect('/dashboard');
}

export async function logout() {
    const session = await getSession();
    session.destroy();
    redirect('/');
}


// --- User Management ---
export async function getUsers(): Promise<User[]> {
    const db = await getDb();
    const users = await db.collection('users').find().sort({ username: 1 }).toArray();
    return users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        passwordHash: u.passwordHash,
        role: u.role || 'admin', // default to admin for old users
    }));
}

export async function createUser(formData: FormData): Promise<void> {
    const db = await getDb();
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
        throw new Error('User with this username already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.collection('users').insertOne({
        username,
        passwordHash,
        role: 'admin', // New users created from UI are admins by default
    });
}

export async function updateUserPassword(userId: string, newPassword: string):Promise<void> {
    if(!ObjectId.isValid(userId)) return;
    const db = await getDb();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { passwordHash } }
    );
}

// --- Settings Management ---
export async function getSettings(): Promise<SchoolSettings> {
    const db = await getDb();
    const settings = await db.collection('settings').findOne({ key: 'school' });
    return settings?.data || {};
}

export async function updateSettings(formData: FormData): Promise<void> {
    const db = await getDb();
    const schoolName = formData.get('schoolName') as string;
    const schoolAddress = formData.get('schoolAddress') as string;
    const schoolPhone = formData.get('schoolPhone') as string;
    
    const settingsData: SchoolSettings = {};
    if (schoolName) settingsData.schoolName = schoolName;
    if (schoolAddress) settingsData.schoolAddress = schoolAddress;
    if (schoolPhone) settingsData.schoolPhone = schoolPhone;

    await db.collection('settings').updateOne(
        { key: 'school' },
        { $set: { key: 'school', data: settingsData } },
        { upsert: true }
    );
}


// --- Class Management ---
export async function getClasses(): Promise<Class[]> {
  const db = await getDb();
  const classes = await db.collection('classes').find().sort({ name: 1, section: 1 }).toArray();
  return classes.map(c => ({
    id: c._id.toString(),
    name: c.name,
    section: c.section,
    fees: c.fees || {}
  }));
}

export async function getClassById(classId: string): Promise<Class | null> {
  if (!ObjectId.isValid(classId)) return null;
  const db = await getDb();
  const classData = await db.collection('classes').findOne({ _id: new ObjectId(classId) });
  if (!classData) return null;
  return {
    id: classData._id.toString(),
    name: classData.name,
    section: classData.section,
    fees: classData.fees || {}
  };
}

export async function addClass(formData: FormData): Promise<void> {
  const name = formData.get('name') as string;
  const section = formData.get('section') as string;
  const db = await getDb();
  const defaultFees: ClassFees = {
    registration: 0,
    monthly: 0,
    exam: 0,
    sports: 0,
    music: 0,
    medical: 0,
    tuition: 0,
    stationery: 0,
    tieBelt: 0,
  }
  await db.collection('classes').insertOne({ name, section, fees: defaultFees });
}

export async function updateClass(classId: string, name: string, section: string): Promise<void> {
    if (!ObjectId.isValid(classId)) return;
    const db = await getDb();
    await db.collection('classes').updateOne(
        { _id: new ObjectId(classId) },
        { $set: { name, section } }
    );
}


export async function updateClassFees(classId: string, newFees: Partial<ClassFees>): Promise<void> {
    if (!ObjectId.isValid(classId)) return;
    const db = await getDb();

    const existingClass = await db.collection('classes').findOne({ _id: new ObjectId(classId) });
    
    const currentFees: ClassFees = (existingClass && typeof existingClass.fees === 'object' && existingClass.fees !== null)
      ? { ...existingClass.fees } as ClassFees
      : {
          registration: 0, monthly: 0, exam: 0, sports: 0, music: 0, medical: 0, tuition: 0, stationery: 0, tieBelt: 0
        };
  
    const updatedFees = { ...currentFees, ...newFees };
  
    await db.collection('classes').updateOne(
      { _id: new ObjectId(classId) },
      { $set: { fees: updatedFees } }
    );
}

// --- Student Management ---
export async function getStudents(filters: { classId?: string, name?: string } = {}): Promise<Student[]> {
  const db = await getDb();
  const query: any = {};
  if (filters.classId) {
    if (ObjectId.isValid(filters.classId)) {
        query.classId = new ObjectId(filters.classId);
    } else {
        return [];
    }
  }
  if (filters.name) {
    query.name = { $regex: filters.name, $options: 'i' };
  }

  const students = await db.collection('students').find(query).sort({ rollNumber: 1, name: 1 }).toArray();
  return students.map(s => ({
    id: s._id.toString(),
    sid: s.sid,
    name: s.name,
    rollNumber: s.rollNumber,
    classId: s.classId.toString(),
    address: s.address,
    openingBalance: s.openingBalance || 0,
    inTuition: s.inTuition || false,
  }));
}

export async function getStudentById(studentId: string): Promise<Student | null> {
    if (!ObjectId.isValid(studentId)) return null;
    const db = await getDb();
    const student = await db.collection('students').findOne({ _id: new ObjectId(studentId) });
    if (!student) return null;
    return {
      id: student._id.toString(),
      sid: student.sid,
      name: student.name,
      rollNumber: student.rollNumber,
      classId: student.classId.toString(),
      address: student.address,
      openingBalance: student.openingBalance || 0,
      inTuition: student.inTuition || false,
    };
  }
  

export async function addStudent(formData: FormData): Promise<void> {
    const name = formData.get('name') as string;
    const classId = formData.get('classId') as string;
    const address = formData.get('address') as string;
    const rollNumber = formData.get('rollNumber') as string;
    const openingBalance = formData.get('openingBalance') as string;
    const inTuition = formData.get('inTuition') === 'on';
    
    const sid = Math.floor(100000 + Math.random() * 900000).toString();
    
    const db = await getDb();
    await db.collection('students').insertOne({
        sid,
        name,
        rollNumber: Number(rollNumber),
        classId: new ObjectId(classId),
        address,
        openingBalance: Number(openingBalance) || 0,
        inTuition,
    });
}

export async function updateStudent(studentId: string, formData: FormData): Promise<void> {
    if (!ObjectId.isValid(studentId)) return;
    
    const db = await getDb();

    const updateData: Partial<Student> & { classId: ObjectId } = {
        name: formData.get('name') as string,
        rollNumber: Number(formData.get('rollNumber')),
        classId: new ObjectId(formData.get('classId') as string),
        address: formData.get('address') as string,
        openingBalance: Number(formData.get('openingBalance')),
        inTuition: formData.get('inTuition') === 'on',
    };

    await db.collection('students').updateOne(
        { _id: new ObjectId(studentId) },
        { $set: updateData }
    );
}

// --- Accounting / Invoicing ---
export async function getPayments(studentId: string): Promise<PaymentTransaction[]> {
    const db = await getDb();
    const invoices = await db.collection('invoices').find({ studentId: new ObjectId(studentId) }).toArray();
    let allPayments: PaymentTransaction[] = [];
    invoices.forEach(invoice => {
        if(invoice.payments) {
            allPayments = [...allPayments, ...invoice.payments.map((p: any) => ({...p, id: p._id.toString()}))]
        }
    });
    return allPayments;
}
  

export async function getInvoicesForStudent(studentId: string): Promise<Invoice[]> {
    const db = await getDb();
    if (!ObjectId.isValid(studentId)) return [];
    const invoices = await db.collection('invoices').find({ studentId: new ObjectId(studentId) }).sort({ year: -1, createdAt: -1 }).toArray();
    return Promise.all(invoices.map(async i => {
      const payments = i.payments?.map((p: any) => ({ ...p, date: new Date(p.date), id: p._id.toString() })) || [];
      return {
        id: i._id.toString(),
        studentId: i.studentId.toString(),
        classId: i.classId.toString(),
        month: i.month,
        year: i.year,
        lineItems: i.lineItems,
        totalBilled: i.totalBilled,
        payments: payments,
        totalPaid: i.totalPaid || 0,
        balance: i.balance,
        createdAt: i.createdAt,
      }
    }));
}

export async function getInvoiceForMonth(studentId: string, month: string, year: number): Promise<Invoice | null> {
    if (!ObjectId.isValid(studentId)) return null;
    const db = await getDb();
    const invoiceData = await db.collection('invoices').findOne({ 
        studentId: new ObjectId(studentId),
        month: month,
        year: year
    });

    if (!invoiceData) return null;

    return {
        id: invoiceData._id.toString(),
        studentId: invoiceData.studentId.toString(),
        classId: invoiceData.classId.toString(),
        month: invoiceData.month,
        year: invoiceData.year,
        lineItems: invoiceData.lineItems,
        totalBilled: invoiceData.totalBilled,
        payments: invoiceData.payments?.map((p: any) => ({ ...p, date: new Date(p.date), id: p._id.toString() })) || [],
        totalPaid: invoiceData.totalPaid || 0,
        balance: invoiceData.balance,
        createdAt: invoiceData.createdAt,
    };
}


export async function getLatestInvoice(studentId: string): Promise<Invoice | null> {
    const invoices = await getInvoicesForStudent(studentId);
    return invoices.length > 0 ? invoices[0] : null;
}

export async function createOrUpdateInvoice(
    studentId: string,
    classId: string,
    month: string,
    year: number,
    chargedFees: { feeType: keyof ClassFees; amount: number }[],
    medicalFee: number
  ): Promise<string> {
    const db = await getDb();
    const studentObjectId = new ObjectId(studentId);
  
    const student = await db.collection('students').findOne({ _id: studentObjectId });
    if (!student) throw new Error("Student not found");
    const sClass = await db.collection('classes').findOne({ _id: new ObjectId(classId) });
    if (!sClass) throw new Error("Class not found");

    const previousInvoice = await db.collection('invoices')
      .findOne(
        { studentId: studentObjectId },
        { sort: { year: -1, createdAt: -1 } }
      );
    
    const previousBalance = previousInvoice ? previousInvoice.balance : (student?.openingBalance || 0);

    const lineItems: InvoiceLineItem[] = [];
    
    chargedFees.forEach(fee => {
      lineItems.push({ feeType: fee.feeType, amount: fee.amount });
    });
    
    // Automatically add tuition fee if the student is in tuition
    if (student.inTuition && sClass.fees.tuition > 0 && !chargedFees.some(f => f.feeType === 'tuition')) {
        lineItems.push({ feeType: 'tuition', amount: sClass.fees.tuition });
    }

    if (medicalFee > 0) {
      lineItems.push({ feeType: 'Medical', amount: medicalFee });
    }
  
    const currentMonthFeesTotal = lineItems.reduce((acc, item) => acc + item.amount, 0);

    // Filter out old Previous Dues before adding new one
    const filteredLineItems = lineItems.filter(item => item.feeType !== 'Previous Dues');
    
    if (previousBalance > 0) { // Only add previous dues if there is a balance
      filteredLineItems.unshift({ feeType: 'Previous Dues', amount: previousBalance });
    }
  
    const totalBilled = currentMonthFeesTotal + previousBalance;
  
    const existingInvoice = await db.collection('invoices').findOne({ studentId: studentObjectId, month, year });
  
    if (existingInvoice) {
      const newBalance = totalBilled - existingInvoice.totalPaid;
      await db.collection('invoices').updateOne(
        { _id: existingInvoice._id },
        {
          $set: {
            lineItems: filteredLineItems,
            totalBilled,
            balance: newBalance,
            createdAt: new Date(),
          }
        }
      );
      return existingInvoice._id.toString();
    } else {
      const result = await db.collection('invoices').insertOne({
        studentId: studentObjectId,
        classId: new ObjectId(classId),
        month,
        year,
        lineItems: filteredLineItems,
        totalBilled,
        totalPaid: 0,
        balance: totalBilled,
        createdAt: new Date(),
        payments: [],
      });
      return result.insertedId.toString();
    }
}

export async function bulkCreateInvoices(
    classId: string,
    month: string,
    year: number,
    chargedFees: { feeType: keyof ClassFees; amount: number }[]
  ): Promise<{ created: number; updated: number }> {
    const students = await getStudents({ classId });
    let createdCount = 0;
    let updatedCount = 0;
    const db = await getDb();

    for (const student of students) {
        const existingInvoice = await db.collection('invoices').findOne({ studentId: new ObjectId(student.id), month, year });
        await createOrUpdateInvoice(student.id, classId, month, year, chargedFees, 0);
        if (existingInvoice) {
            updatedCount++;
        } else {
            createdCount++;
        }
    }

    return { created: createdCount, updated: updatedCount };
}
  
export async function addPayment(studentId: string, invoiceId: string, amount: number): Promise<PaymentTransaction> {
    const db = await getDb();
    const invoiceObjectId = new ObjectId(invoiceId);
  
    const paymentRecord: PaymentTransaction = {
        id: new ObjectId().toString(),
        amount,
        date: new Date(),
    };

    const result = await db.collection('invoices').updateOne(
        { _id: invoiceObjectId },
        {
            $inc: {
                totalPaid: amount,
                balance: -amount,
            },
            $push: {
                payments: {
                    _id: new ObjectId(paymentRecord.id),
                    amount: paymentRecord.amount,
                    date: paymentRecord.date,
                }
            }
        }
    );

    if (result.modifiedCount === 0) {
        throw new Error("Failed to find and update the invoice.");
    }
    
    // Adjust balance on all subsequent invoices for this student
    const studentObjectId = new ObjectId(studentId);
    const updatedInvoice = await db.collection('invoices').findOne({ _id: invoiceObjectId });
    if (!updatedInvoice) throw new Error("Could not retrieve updated invoice");

    const subsequentInvoices = await db.collection('invoices').find({
        studentId: studentObjectId,
        createdAt: { $gt: updatedInvoice.createdAt }
    }).toArray();
    
    for (const inv of subsequentInvoices) {
        // Here we just adjust the balance based on the new payment, not re-calculating everything
        await db.collection('invoices').updateOne(
            { _id: inv._id },
            { $inc: { balance: -amount } }
        );
    }
    return paymentRecord;
}

export async function checkInvoicesExistForMonth(classId: string, month: string, year: number): Promise<boolean> {
    if (!ObjectId.isValid(classId)) return false;
    const db = await getDb();
    const count = await db.collection('invoices').countDocuments({
        classId: new ObjectId(classId),
        month: month,
        year: year
    });
    return count > 0;
}

// --- Exam Management ---
export async function getExams(): Promise<Exam[]> {
    const db = await getDb();
    const exams = await db.collection('exams').find().sort({ date: -1 }).toArray();
    return exams.map(e => ({
        id: e._id.toString(),
        name: e.name,
        date: new Date(e.date),
    }));
}

export async function getExamById(examId: string): Promise<Exam | null> {
    if (!ObjectId.isValid(examId)) return null;
    const db = await getDb();
    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) return null;
    return {
        id: exam._id.toString(),
        name: exam.name,
        date: new Date(exam.date),
    };
}

export async function addExam(formData: FormData): Promise<void> {
    const db = await getDb();
    const name = formData.get('name') as string;
    const date = formData.get('date') as string;
    await db.collection('exams').insertOne({
        name,
        date: new Date(date),
    });
}


// --- Subject & Result Management ---
export async function getSubjects(): Promise<Subject[]> {
  const db = await getDb();
  const subjects = await db.collection('subjects').find().toArray();
  return subjects.map(s => ({
    id: s._id.toString(),
    name: s.name,
    classId: s.classId.toString(),
    fullMarksTheory: s.fullMarksTheory || 100,
    fullMarksPractical: s.fullMarksPractical || 0,
  }));
}

export async function addSubject(classId: string, name: string, fullMarksTheory: number, fullMarksPractical: number): Promise<void> {
    if (!ObjectId.isValid(classId)) return;
    const db = await getDb();
    await db.collection('subjects').insertOne({
        name,
        classId: new ObjectId(classId),
        fullMarksTheory,
        fullMarksPractical,
    });
}

export async function updateSubject(subjectId: string, name: string, fullMarksTheory: number, fullMarksPractical: number): Promise<void> {
    if (!ObjectId.isValid(subjectId)) return;
    const db = await getDb();
    await db.collection('subjects').updateOne(
        { _id: new ObjectId(subjectId) },
        {
            $set: {
                name,
                fullMarksTheory,
                fullMarksPractical,
            }
        }
    );
}

export async function deleteSubject(subjectId: string): Promise<void> {
    if (!ObjectId.isValid(subjectId)) return;
    const db = await getDb();
    await db.collection('subjects').deleteOne({ _id: new ObjectId(subjectId) });
    // Also delete associated results
    await db.collection('results').deleteMany({ subjectId: new ObjectId(subjectId) });
}


export async function getResultsForExam(examId: string): Promise<Result[]> {
  if (!ObjectId.isValid(examId)) return [];
  const db = await getDb();
  const results = await db.collection('results').find({ examId: new ObjectId(examId) }).toArray();
  return results.map(r => ({
    id: r._id.toString(),
    examId: r.examId.toString(),
    studentId: r.studentId.toString(),
    subjectId: r.subjectId.toString(),
    theoryMarks: r.theoryMarks,
    practicalMarks: r.practicalMarks
  }));
}

export async function addOrUpdateResult(examId: string, studentId: string, subjectId: string, theoryMarks: number, practicalMarks: number): Promise<void> {
    if (!ObjectId.isValid(examId) || !ObjectId.isValid(studentId) || !ObjectId.isValid(subjectId)) return;
    const db = await getDb();

    await db.collection('results').updateOne(
        { examId: new ObjectId(examId), studentId: new ObjectId(studentId), subjectId: new ObjectId(subjectId) },
        {
            $set: {
                theoryMarks,
                practicalMarks,
            }
        },
        { upsert: true }
    );
}
