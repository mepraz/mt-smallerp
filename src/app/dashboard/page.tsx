
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Users, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { getStudents, getClasses, getPayments } from "@/lib/data"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import type { Student, Class, Payment } from "@/lib/types"

export default function DashboardPage() {
  const [students, setStudents] = useState<Student[] | null>(null)
  const [classes, setClasses] = useState<Class[] | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [studentsData, classesData, paymentsData] = await Promise.all([
          getStudents(),
          getClasses(),
          getPayments(),
        ]);
        setStudents(studentsData)
        setClasses(classesData)
        setPayments(paymentsData)
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading || !students || !classes || !payments) {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
  }

  const totalStudents = students.length;

  const totalReceivable = classes.reduce((acc, c) => {
    const studentsInClass = students.filter(s => s.classId === c.id).length;
    const classTotalFees = Object.values(c.fees).reduce((sum, fee) => sum + (fee || 0), 0);
    return acc + studentsInClass * classTotalFees;
  }, 0);

  const totalCollected = payments.reduce((acc, p) => acc + p.amount, 0)
  const outstandingDues = totalReceivable - totalCollected

  const chartData = [
    { name: "Receivable", value: totalReceivable, fill: "var(--color-receivable)" },
    { name: "Collected", value: totalCollected, fill: "var(--color-collected)" },
    { name: "Outstanding", value: outstandingDues, fill: "var(--color-outstanding)" },
  ]

  const chartConfig = {
    value: {
      label: "Amount (NPR)",
    },
    receivable: {
      label: "Receivable",
      color: "hsl(var(--secondary))",
    },
    collected: {
      label: "Collected",
      color: "hsl(var(--accent))",
    },
    outstanding: {
      label: "Outstanding",
      color: "hsl(var(--destructive))",
    },
  } satisfies ChartConfig


  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivable</CardTitle>
            <span className="h-4 w-4 text-muted-foreground font-semibold">रु</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">रु{totalReceivable.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <span className="h-4 w-4 text-muted-foreground font-semibold">रु</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">रु{totalCollected.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Dues</CardTitle>
            <span className="h-4 w-4 text-muted-foreground font-semibold">रु</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">रु{outstandingDues.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Fee Collection Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis tickFormatter={(value) => `रु${Number(value) / 1000}k`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="value" radius={4} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
